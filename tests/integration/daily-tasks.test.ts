import { and, eq, sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ensureTasksForDate } from "@/application/tasks/ensure-daily-tasks";
import { getPlanningSummary } from "@/application/tasks/planning";
import { createUserTemplate } from "@/application/templates/create-template";
import { updateUserTemplate } from "@/application/templates/manage-template";
import { ensureAttributes, listAttributes } from "@/db/repositories/attributes";
import { createSkill } from "@/db/repositories/skills";
import {
  archiveTemplate,
  createTemplate,
} from "@/db/repositories/task-templates";
import { createTask } from "@/db/repositories/tasks";
import * as schema from "@/db/schema";
import { tasks, users } from "@/db/schema";
import { addDaysToDate, getIsoWeekday } from "@/lib/dates/local-date";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("ensureTasksForDate (integration)", () => {
  let client: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;
  let userId: string;
  let skillId: string;

  const DATE = "2026-07-13";

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
      sql`truncate table xp_transactions, task_completions, streaks, tasks, task_templates, user_skills, user_attributes, skills, sessions, users restart identity cascade`,
    );
    const [user] = await db
      .insert(users)
      .values({ telegramId: 710_000_001n, firstName: "Player" })
      .returning();
    userId = user.id;
    const attrs = await listAttributes(db);
    const skill = await createSkill(db, {
      userId,
      attributeId: attrs.find((a) => a.code === "body")!.id,
      name: "Кардио",
    });
    skillId = skill.id;
  });

  it("materialises a daily template task once, even concurrently", async () => {
    const template = await createTemplate(db, {
      userId,
      skillId,
      title: "Зарядка",
      baseXp: 20,
      difficulty: "normal",
      recurrenceType: "daily",
      estimatedMinutes: 15,
    });

    await Promise.all([
      ensureTasksForDate(userId, DATE, db),
      ensureTasksForDate(userId, DATE, db),
      ensureTasksForDate(userId, DATE, db),
    ]);

    const rows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.localDate, DATE)));
    expect(rows).toHaveLength(1);
    expect(rows[0].templateId).toBe(template.id);
    expect(rows[0].estimatedMinutes).toBe(15);
  });

  it("only creates weekday templates on matching days", async () => {
    const weekday = getIsoWeekday(DATE);
    await createTemplate(db, {
      userId,
      skillId,
      title: "Зал",
      baseXp: 30,
      difficulty: "normal",
      recurrenceType: "weekdays",
      weekdays: [weekday],
    });

    const otherDay = addDaysToDate(DATE, 3);
    await ensureTasksForDate(userId, DATE, db);
    await ensureTasksForDate(userId, otherDay, db);

    const onDay = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.localDate, DATE)));
    const onOther = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.localDate, otherDay)));
    expect(onDay).toHaveLength(1);
    expect(onOther).toHaveLength(0);
  });

  it("respects template start and end dates", async () => {
    const startsOn = addDaysToDate(DATE, 1);
    const endsOn = addDaysToDate(DATE, 2);
    await createTemplate(db, {
      userId,
      skillId,
      title: "Короткий цикл",
      baseXp: 20,
      difficulty: "normal",
      recurrenceType: "daily",
      startsOn,
      endsOn,
    });

    for (const offset of [0, 1, 2, 3]) {
      await ensureTasksForDate(userId, addDaysToDate(DATE, offset), db);
    }

    const rows = await db.select().from(tasks).where(eq(tasks.userId, userId));
    expect(rows.map((row) => row.localDate).sort()).toEqual([startsOn, endsOn]);
  });

  it("summarises overdue, today and the next seven days", async () => {
    for (const [title, localDate] of [
      ["Просрочено", addDaysToDate(DATE, -1)],
      ["Сегодня", DATE],
      ["Скоро", addDaysToDate(DATE, 3)],
      ["Позже", addDaysToDate(DATE, 8)],
    ] as const) {
      await createTask(db, {
        userId,
        skillId,
        title,
        localDate,
        baseXp: 20,
        difficulty: "normal",
      });
    }

    const summary = await getPlanningSummary(userId, DATE, db);
    expect(summary.overdueCount).toBe(1);
    expect(summary.todayCount).toBe(1);
    expect(summary.nextSevenCount).toBe(2);
    expect(summary.nextSeven.map((item) => item.date)).toEqual([
      DATE,
      addDaysToDate(DATE, 3),
    ]);
  });

  it("ignores archived templates", async () => {
    const template = await createTemplate(db, {
      userId,
      skillId,
      title: "Старое",
      baseXp: 10,
      difficulty: "easy",
      recurrenceType: "daily",
    });
    await archiveTemplate(db, userId, template.id);

    await ensureTasksForDate(userId, DATE, db);

    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId));
    expect(rows).toHaveLength(0);
  });

  it("rejects duplicate live template titles but allows reuse after archive", async () => {
    const template = await createTemplate(db, {
      userId,
      skillId,
      title: "Зарядка",
      baseXp: 20,
      difficulty: "normal",
      recurrenceType: "daily",
    });

    await expect(
      createUserTemplate(
        {
          userId,
          skillId,
          title: " зарядка ",
          baseXp: 30,
          difficulty: "hard",
          recurrenceType: "daily",
          localDate: DATE,
        },
        db,
      ),
    ).rejects.toMatchObject({ code: "duplicate_template", status: 409 });

    await archiveTemplate(db, userId, template.id);
    const replacement = await createUserTemplate(
      {
        userId,
        skillId,
        title: "ЗАРЯДКА",
        baseXp: 30,
        difficulty: "hard",
        recurrenceType: "daily",
        localDate: DATE,
      },
      db,
    );
    expect(replacement.archivedAt).toBeNull();

    await expect(
      updateUserTemplate(userId, template.id, { isActive: true }, db),
    ).rejects.toMatchObject({ code: "duplicate_template", status: 409 });

    const restored = await updateUserTemplate(
      userId,
      template.id,
      { title: "Разминка", isActive: true },
      db,
    );
    expect(restored.title).toBe("Разминка");
    expect(restored.isActive).toBe(true);
    expect(restored.archivedAt).toBeNull();
  });
});
