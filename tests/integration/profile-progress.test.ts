import { eq, sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { exportUserData } from "@/application/profile/export";
import {
  importBackup,
  importContentPack,
  previewContentPack,
} from "@/application/profile/import-data";
import { getProfileData } from "@/application/profile/get-profile";
import { updateUserProfile } from "@/application/profile/update-profile";
import { getProgressData } from "@/application/progress/get-progress";
import { completeQuest } from "@/application/quests/complete-quest";
import { completeTask } from "@/application/tasks/complete-task";
import { ensureAttributes, listAttributes } from "@/db/repositories/attributes";
import { createSteps, setStepCompleted } from "@/db/repositories/quest-steps";
import { createQuest } from "@/db/repositories/quests";
import { createSkill } from "@/db/repositories/skills";
import { createTask } from "@/db/repositories/tasks";
import * as schema from "@/db/schema";
import { skills, users } from "@/db/schema";
import { addDaysToDate } from "@/lib/dates/local-date";

const url = process.env.TEST_DATABASE_URL;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(
  new Date(),
);

describe.skipIf(!url)("progress, profile & export (integration)", () => {
  let client: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;
  let userId: string;
  let skillId: string;

  beforeAll(async () => {
    client = postgres(url!, { max: 5, onnotice: () => {} });
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    await ensureAttributes(db);
  });

  afterAll(async () => {
    await client?.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await db.execute(
      sql`truncate table xp_transactions, task_completions, streaks, tasks, task_templates, quest_steps, quests, user_achievements, user_skills, user_attributes, skills, sessions, users restart identity cascade`,
    );
    const [user] = await db
      .insert(users)
      .values({ telegramId: 740_000_001n, firstName: "Stat" })
      .returning();
    userId = user.id;
    const attrs = await listAttributes(db);
    const skill = await createSkill(db, {
      userId,
      attributeId: attrs.find((a) => a.code === "mind")!.id,
      name: "Frontend",
    });
    skillId = skill.id;
  });

  async function completeOne(baseXp = 50, localDate = today, title = "Задача") {
    const task = await createTask(db, {
      userId,
      skillId,
      title,
      localDate,
      baseXp,
      difficulty: "normal",
    });
    await completeTask({ userId, taskId: task.id, idempotencyKey: task.id }, db);
  }

  it("aggregates progress for the last 7 days", async () => {
    await completeOne(50);
    await completeOne(100, addDaysToDate(today, -7), "Старая задача");

    const quest = await createQuest(db, {
      userId,
      title: "Квест статистики",
      type: "side",
      rewardXp: 75,
      status: "active",
    });
    await createSteps(db, quest.id, [
      { title: "Шаг", isRequired: true, sortOrder: 0 },
    ]);
    const [step] = await db
      .select()
      .from(schema.questSteps)
      .where(eq(schema.questSteps.questId, quest.id));
    await setStepCompleted(db, step.id, new Date());
    await completeQuest({ userId, questId: quest.id }, db);

    const data = await getProgressData(userId, "7d", "UTC", db);

    expect(data.totalXp).toBe(125);
    expect(data.completedTasks).toBe(1);
    expect(data.daily).toHaveLength(7);
    expect(data.daily.at(-1)).toEqual({ date: today, xp: 125 });
    expect(data.attributes.find((a) => a.code === "mind")?.xp).toBe(13);
    expect(data.recent.find((event) => event.title === "Задача")).toMatchObject({
      kind: "task",
      amount: 50,
      skillXp: 50,
      attributeXp: 13,
    });
    expect(
      data.recent.find((event) => event.title === "Квест статистики"),
    ).toMatchObject({ kind: "quest", amount: 75 });
  });

  it("excludes future-dated legacy completions from progress statistics", async () => {
    const task = await createTask(db, {
      userId,
      skillId,
      title: "Будущая запись",
      localDate: addDaysToDate(today, 1),
      baseXp: 200,
      difficulty: "normal",
    });
    const [completion] = await db
      .insert(schema.taskCompletions)
      .values({
        userId,
        taskId: task.id,
        idempotencyKey: "legacy-future",
        localDate: task.localDate,
        finalXp: 200,
      })
      .returning();
    await db.insert(schema.xpTransactions).values({
      userId,
      amount: 200,
      scope: "global",
      sourceType: "task_completion",
      sourceId: completion.id,
      baseXp: 200,
      multiplier: "1",
    });

    const data = await getProgressData(userId, "all", "UTC", db);
    expect(data.totalXp).toBe(0);
    expect(data.completedTasks).toBe(0);
    expect(data.daily.at(-1)).toEqual({ date: today, xp: 0 });
  });

  it("returns the profile with all attributes and achievements", async () => {
    const data = await getProfileData(userId, db);

    expect(data.attributes).toHaveLength(6);
    expect(data.achievements).toHaveLength(8);
  });

  it("exports serialisable user data without bigint", async () => {
    await completeOne(50);

    const exported = await exportUserData(userId, db);
    const json = JSON.stringify(exported);
    const parsed = JSON.parse(json);

    expect(parsed.user.telegramId).toBe("740000001");
    expect(parsed.format).toBe("life-rpg-export");
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.attributes).toHaveLength(6);
    expect(parsed.achievementCatalog).toHaveLength(8);
    expect(parsed.tasks.length).toBeGreaterThanOrEqual(1);
    expect(parsed.xpTransactions.length).toBeGreaterThanOrEqual(3);
  });

  it("imports a content pack idempotently and rejects changed duplicates", async () => {
    const pack = {
      format: "life-rpg-content-pack",
      formatVersion: 1,
      name: "Тестовый пак",
      skills: [
        {
          key: "reading",
          name: "Чтение книг",
          attributeCode: "mind",
          icon: "📚",
          color: "#6366F1",
        },
      ],
      taskTemplates: [
        {
          title: "Читать 20 минут",
          skillKey: "reading",
          baseXp: 20,
          difficulty: "easy",
          recurrenceType: "daily",
          estimatedMinutes: 20,
        },
      ],
      quests: [
        {
          title: "Прочитать книгу",
          type: "side",
          attributeCode: "mind",
          rewardXp: 100,
          steps: [{ title: "Выбрать книгу" }, { title: "Дочитать" }],
        },
      ],
    };

    const first = await importContentPack(userId, pack, db);
    expect(first.created).toEqual({
      skills: 1,
      tasks: 0,
      taskTemplates: 1,
      quests: 1,
    });
    const [importedTemplate] = await db.select().from(schema.taskTemplates);
    expect(importedTemplate.estimatedMinutes).toBe(20);
    expect(importedTemplate.startsOn).toBe(today);

    const second = await importContentPack(userId, pack, db);
    expect(second.created).toEqual({
      skills: 0,
      tasks: 0,
      taskTemplates: 0,
      quests: 0,
    });
    expect(second.skipped).toEqual({
      skills: 1,
      tasks: 0,
      taskTemplates: 1,
      quests: 1,
    });

    await expect(
      importContentPack(
        userId,
        {
          ...pack,
          skills: [{ ...pack.skills[0], attributeCode: "body" }],
        },
        db,
      ),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("previews and imports portable v2 content with dependency-safe selection", async () => {
    const pack = {
      format: "life-rpg-content-pack",
      formatVersion: 2,
      name: "Пак v2",
      skills: [
        {
          key: "planning",
          name: "Планирование",
          attributeCode: "discipline",
        },
      ],
      tasks: [
        {
          title: "Разобрать входящие",
          skillKey: "planning",
          baseXp: 25,
          difficulty: "normal",
          estimatedMinutes: 30,
          scheduledInDays: 2,
        },
      ],
      taskTemplates: [
        {
          title: "План на день",
          skillKey: "planning",
          baseXp: 15,
          difficulty: "easy",
          recurrenceType: "daily",
          estimatedMinutes: 10,
          startsInDays: 1,
          endsInDays: 30,
        },
      ],
      quests: [
        {
          title: "Настроить систему",
          type: "main",
          attributeCode: "discipline",
          rewardXp: 300,
          dueInDays: 14,
          steps: [{ title: "Собрать первый план" }],
        },
      ],
    } as const;

    const dependencyPreview = await previewContentPack(
      userId,
      pack,
      {
        anchorDate: today,
        selection: {
          skills: false,
          tasks: true,
          taskTemplates: false,
          quests: false,
        },
      },
      db,
    );
    expect(dependencyPreview.summary.rejected.tasks).toBe(1);
    expect(dependencyPreview.conflicts[0]).toContain("выберите импорт навыков");

    const preview = await previewContentPack(
      userId,
      pack,
      { anchorDate: today },
      db,
    );
    expect(preview.summary.created).toEqual({
      skills: 1,
      tasks: 1,
      taskTemplates: 1,
      quests: 1,
    });
    expect(preview.conflicts).toEqual([]);

    await importContentPack(userId, pack, db, { anchorDate: today });
    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.title, "Разобрать входящие"));
    expect(task.localDate).toBe(addDaysToDate(today, 2));
    expect(task.estimatedMinutes).toBe(30);
    const [template] = await db
      .select()
      .from(schema.taskTemplates)
      .where(eq(schema.taskTemplates.title, "План на день"));
    expect(template.startsOn).toBe(addDaysToDate(today, 1));
    expect(template.endsOn).toBe(addDaysToDate(today, 30));
    const [quest] = await db
      .select()
      .from(schema.quests)
      .where(eq(schema.quests.title, "Настроить систему"));
    expect(quest.dueDate).toBe(addDaysToDate(today, 14));

    const repeated = await previewContentPack(
      userId,
      pack,
      { anchorDate: today },
      db,
    );
    expect(repeated.summary.skipped).toEqual({
      skills: 1,
      tasks: 1,
      taskTemplates: 1,
      quests: 1,
    });
  });

  it("restores a versioned export only with explicit replacement", async () => {
    await completeOne(50);
    const backup = JSON.parse(JSON.stringify(await exportUserData(userId, db)));
    const attrs = await listAttributes(db);
    await createSkill(db, {
      userId,
      attributeId: attrs.find((attribute) => attribute.code === "body")!.id,
      name: "После экспорта",
    });

    await expect(importBackup(userId, backup, false, db)).rejects.toMatchObject({
      code: "account_not_empty",
    });
    await importBackup(userId, backup, true, db);

    const restoredSkills = await db
      .select()
      .from(skills)
      .where(eq(skills.userId, userId));
    expect(restoredSkills.map((skill) => skill.name)).not.toContain(
      "После экспорта",
    );
    expect((await getProgressData(userId, "all", "UTC", db)).totalXp).toBe(50);
  });

  it("rejects an invalid timezone", async () => {
    await expect(
      updateUserProfile(userId, { timezone: "Mars/Base" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });
});
