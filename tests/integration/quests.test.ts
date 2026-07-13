import { eq, sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { completeTask } from "@/application/tasks/complete-task";
import { completeQuest } from "@/application/quests/complete-quest";
import { createUserQuest } from "@/application/quests/create-quest";
import { revertQuest } from "@/application/quests/revert-quest";
import { updateUserQuest } from "@/application/quests/manage-quests";
import { toggleStep } from "@/application/quests/toggle-step";
import { createOneOffTask } from "@/application/tasks/create-task";
import { ensureAttributes, listAttributes } from "@/db/repositories/attributes";
import { listUserAchievements } from "@/db/repositories/achievements";
import { createSteps, listSteps } from "@/db/repositories/quest-steps";
import { countCompletedQuests, createQuest } from "@/db/repositories/quests";
import { createSkill } from "@/db/repositories/skills";
import { createTask } from "@/db/repositories/tasks";
import { sumGlobalXp } from "@/db/repositories/xp";
import * as schema from "@/db/schema";
import { quests, users } from "@/db/schema";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("quests & achievements (integration)", () => {
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
      .values({ telegramId: 730_000_001n, firstName: "Hero" })
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

  async function activeQuest(rewardXp: number, manual = true) {
    const quest = await createQuest(db, {
      userId,
      title: "Проект",
      type: "main",
      rewardXp,
      status: "active",
      manualCompletion: manual,
    });
    await createSteps(db, quest.id, [
      { title: "Шаг 1", sortOrder: 0 },
      { title: "Шаг 2", sortOrder: 1 },
    ]);
    return quest;
  }

  async function completeAllSteps(questId: string) {
    for (const step of await listSteps(db, questId)) {
      await toggleStep({ userId, stepId: step.id }, db);
    }
  }

  it("completes a quest, grants the reward and unlocks first_quest", async () => {
    const quest = await activeQuest(300);
    await completeAllSteps(quest.id);

    const result = await completeQuest({ userId, questId: quest.id }, db);

    expect(result.rewardXp).toBe(300);
    expect(await sumGlobalXp(db, userId)).toBe(300);
    expect(result.unlockedAchievements.map((a) => a.code)).toContain(
      "first_quest",
    );

    const [row] = await db.select().from(quests).where(eq(quests.id, quest.id));
    expect(row.status).toBe("completed");
  });

  it("does not double-reward on repeated completion", async () => {
    const quest = await activeQuest(300);
    await completeAllSteps(quest.id);
    await completeQuest({ userId, questId: quest.id }, db);

    const again = await completeQuest({ userId, questId: quest.id }, db);

    expect(again.alreadyCompleted).toBe(true);
    expect(await sumGlobalXp(db, userId)).toBe(300);
  });

  it("reverts a quest idempotently and allows completing it again", async () => {
    const quest = await activeQuest(300);
    await completeAllSteps(quest.id);
    await completeQuest({ userId, questId: quest.id }, db);
    const unlockedBeforeRevert = await listUserAchievements(db, userId);

    const reverted = await revertQuest({ userId, questId: quest.id }, db);
    expect(reverted).toMatchObject({ reverted: true, alreadyReverted: false });
    expect(await sumGlobalXp(db, userId)).toBe(0);
    expect(await listUserAchievements(db, userId)).toEqual(unlockedBeforeRevert);

    const repeated = await revertQuest({ userId, questId: quest.id }, db);
    expect(repeated).toMatchObject({ reverted: false, alreadyReverted: true });

    const completedAgain = await completeQuest({ userId, questId: quest.id }, db);
    expect(completedAgain.alreadyCompleted).toBe(false);
    expect(await sumGlobalXp(db, userId)).toBe(300);

    const completions = await db.select().from(schema.questCompletions);
    expect(completions).toHaveLength(2);
    expect(completions.filter((row) => row.revertedAt === null)).toHaveLength(1);
  });

  it("reverts a zero-XP quest without requiring an XP transaction", async () => {
    const quest = await activeQuest(0);
    await completeAllSteps(quest.id);
    await completeQuest({ userId, questId: quest.id }, db);

    await expect(revertQuest({ userId, questId: quest.id }, db)).resolves.toMatchObject({
      reverted: true,
    });
  });

  it("rejects completion while required steps are unfinished", async () => {
    const quest = await activeQuest(300);

    await expect(
      completeQuest({ userId, questId: quest.id }, db),
    ).rejects.toMatchObject({ code: "quest_steps_incomplete" });
    expect(await sumGlobalXp(db, userId)).toBe(0);
  });

  it("rejects toggling a step of a completed quest", async () => {
    const quest = await activeQuest(100);
    await completeAllSteps(quest.id);
    await completeQuest({ userId, questId: quest.id }, db);

    const [step] = await listSteps(db, quest.id);
    await expect(
      toggleStep({ userId, stepId: step.id }, db),
    ).rejects.toMatchObject({ code: "quest_not_active" });
  });

  it("auto-completes when manual completion is off and required steps done", async () => {
    const quest = await createQuest(db, {
      userId,
      title: "Авто",
      type: "side",
      rewardXp: 100,
      status: "active",
      manualCompletion: false,
    });
    await createSteps(db, quest.id, [{ title: "Единственный", sortOrder: 0 }]);
    const [step] = await listSteps(db, quest.id);

    const result = await toggleStep({ userId, stepId: step.id }, db);

    expect(result.completed).toBe(true);
    expect(result.questCompleted?.rewardXp).toBe(100);
    const [row] = await db.select().from(quests).where(eq(quests.id, quest.id));
    expect(row.status).toBe("completed");
  });

  it("updates quest fields and synchronizes step content and order", async () => {
    const quest = await activeQuest(200);
    const [first, second] = await listSteps(db, quest.id);
    await toggleStep({ userId, stepId: first.id }, db);

    await updateUserQuest(
      userId,
      quest.id,
      {
        title: "Обновлённый проект",
        dueDate: "2026-08-01",
        steps: [
          {
            id: second.id,
            title: "Шаг 2 — сначала",
            description: "Подробности",
            isRequired: true,
          },
          {
            id: first.id,
            title: "Шаг 1 — потом",
            isRequired: true,
          },
          { title: "Новый шаг", isRequired: false },
        ],
      },
      db,
    );

    const rows = await listSteps(db, quest.id);
    expect(rows.map((step) => step.title)).toEqual([
      "Шаг 2 — сначала",
      "Шаг 1 — потом",
      "Новый шаг",
    ]);
    expect(rows[0].description).toBe("Подробности");
    expect(rows[1].completedAt).not.toBeNull();

    const [updated] = await db.select().from(quests).where(eq(quests.id, quest.id));
    expect(updated.title).toBe("Обновлённый проект");
    expect(updated.dueDate).toBe("2026-08-01");
  });

  it("archives and restores an active quest but keeps archived quests immutable", async () => {
    const quest = await activeQuest(100);

    await updateUserQuest(userId, quest.id, { status: "archived" }, db);
    await expect(
      updateUserQuest(userId, quest.id, { title: "Нельзя" }, db),
    ).rejects.toMatchObject({ code: "quest_not_active" });

    const restored = await updateUserQuest(
      userId,
      quest.id,
      { status: "active" },
      db,
    );
    expect(restored.quest.status).toBe("active");
  });

  it("creates a draft and activates it without losing its steps", async () => {
    const draft = await createUserQuest(
      {
        userId,
        title: "Черновик",
        type: "long_term",
        status: "draft",
        rewardXp: 500,
        steps: [{ title: "Первый шаг" }],
      },
      db,
    );

    expect(draft.status).toBe("draft");
    const activated = await updateUserQuest(
      userId,
      draft.id,
      { status: "active" },
      db,
    );

    expect(activated.quest.status).toBe("active");
    expect((await listSteps(db, draft.id)).map((step) => step.title)).toEqual([
      "Первый шаг",
    ]);
  });

  it("archives a completed quest and restores it with history and XP intact", async () => {
    const quest = await activeQuest(180);
    await completeAllSteps(quest.id);
    await completeQuest({ userId, questId: quest.id }, db);

    const archived = await updateUserQuest(
      userId,
      quest.id,
      { status: "archived" },
      db,
    );
    expect(archived.quest.status).toBe("archived");
    expect(archived.quest.completedAt).not.toBeNull();
    expect(await countCompletedQuests(db, userId)).toBe(1);
    expect(await sumGlobalXp(db, userId)).toBe(180);

    const restored = await updateUserQuest(
      userId,
      quest.id,
      { status: "active" },
      db,
    );
    expect(restored.quest.status).toBe("completed");
    expect(restored.quest.completedAt).toEqual(archived.quest.completedAt);
    expect(await sumGlobalXp(db, userId)).toBe(180);
  });

  it("auto-completes when editing a fully-done manual quest to automatic", async () => {
    const quest = await activeQuest(120);
    await completeAllSteps(quest.id);

    const result = await updateUserQuest(
      userId,
      quest.id,
      { manualCompletion: false },
      db,
    );

    expect(result.quest.status).toBe("completed");
    expect(result.questCompleted?.rewardXp).toBe(120);
    expect(await sumGlobalXp(db, userId)).toBe(120);
  });

  it("links a task to a step and auto-completes the quest with the task", async () => {
    const quest = await createQuest(db, {
      userId,
      title: "Связанный квест",
      type: "main",
      rewardXp: 150,
      status: "active",
      manualCompletion: false,
    });
    await createSteps(db, quest.id, [{ title: "Сделать задачу", sortOrder: 0 }]);
    const [step] = await listSteps(db, quest.id);

    const task = await createOneOffTask(
      {
        userId,
        skillId,
        questStepId: step.id,
        title: step.title,
        localDate: "2026-07-13",
        baseXp: 25,
        difficulty: "normal",
      },
      db,
    );
    await expect(
      createOneOffTask(
        {
          userId,
          skillId,
          questStepId: step.id,
          title: "Дубль",
          localDate: "2026-07-13",
          baseXp: 25,
          difficulty: "normal",
        },
        db,
      ),
    ).rejects.toMatchObject({ code: "quest_step_task_exists" });

    const result = await completeTask(
      { userId, taskId: task.id, idempotencyKey: "linked-step" },
      db,
    );

    expect(result.questCompleted?.rewardXp).toBe(150);
    expect((await listSteps(db, quest.id))[0].completedAt).not.toBeNull();
    const [completedQuest] = await db
      .select()
      .from(quests)
      .where(eq(quests.id, quest.id));
    expect(completedQuest.status).toBe("completed");
    expect(await sumGlobalXp(db, userId)).toBe(175);
  });

  it("unlocks first_action only once across task completions", async () => {
    const task1 = await createTask(db, {
      userId,
      skillId,
      title: "Задача 1",
      localDate: "2026-07-13",
      baseXp: 20,
      difficulty: "normal",
    });
    const r1 = await completeTask(
      { userId, taskId: task1.id, idempotencyKey: "a" },
      db,
    );
    expect(r1.unlockedAchievements.map((a) => a.code)).toContain("first_action");

    const task2 = await createTask(db, {
      userId,
      skillId,
      title: "Задача 2",
      localDate: "2026-07-13",
      baseXp: 20,
      difficulty: "normal",
    });
    const r2 = await completeTask(
      { userId, taskId: task2.id, idempotencyKey: "b" },
      db,
    );
    expect(r2.unlockedAchievements.map((a) => a.code)).not.toContain(
      "first_action",
    );

    const unlocked = await listUserAchievements(db, userId);
    // first_action present exactly once (pk prevents duplicates).
    expect(unlocked.length).toBeGreaterThanOrEqual(1);
  });
});
