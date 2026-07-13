import { asc, eq, sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { completeTask } from "@/application/tasks/complete-task";
import { ensureTasksForDate } from "@/application/tasks/ensure-daily-tasks";
import { revertTask } from "@/application/tasks/revert-task";
import { ensureAttributes, listAttributes } from "@/db/repositories/attributes";
import { createSkill } from "@/db/repositories/skills";
import { createTemplate } from "@/db/repositories/task-templates";
import { createTask } from "@/db/repositories/tasks";
import {
  getUserAttributeXp,
  getUserSkillXp,
  sumGlobalXp,
} from "@/db/repositories/xp";
import * as schema from "@/db/schema";
import { taskCompletions, tasks, users, xpTransactions } from "@/db/schema";
import { addDaysToDate } from "@/lib/dates/local-date";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("revert & concurrency (integration)", () => {
  let client: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;
  let userId: string;
  let skillId: string;
  let attributeId: string;

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
      .values({ telegramId: 720_000_001n, firstName: "Player" })
      .returning();
    userId = user.id;
    const attrs = await listAttributes(db);
    attributeId = attrs.find((a) => a.code === "body")!.id;
    const skill = await createSkill(db, { userId, attributeId, name: "Кардио" });
    skillId = skill.id;
  });

  async function oneOff(baseXp = 50) {
    return createTask(db, {
      userId,
      skillId,
      title: "Задача",
      localDate: DATE,
      baseXp,
      difficulty: "normal",
    });
  }

  it("rolls back XP and returns the task to pending", async () => {
    const task = await oneOff(50);
    await completeTask({ userId, taskId: task.id, idempotencyKey: "k1" }, db);

    const result = await revertTask({ userId, taskId: task.id }, db);
    expect(result.reverted).toBe(true);

    expect(await sumGlobalXp(db, userId)).toBe(0);
    expect(await getUserSkillXp(db, userId, skillId)).toBe(0);
    expect(await getUserAttributeXp(db, userId, attributeId)).toBe(0);

    const [t] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(t.status).toBe("pending");

    // 3 accruals + 3 compensating entries.
    expect(await db.select().from(xpTransactions)).toHaveLength(6);
    const [completion] = await db.select().from(taskCompletions);
    expect(completion.revertedAt).not.toBeNull();
  });

  it("can be completed again after a revert", async () => {
    const task = await oneOff(50);
    await completeTask({ userId, taskId: task.id, idempotencyKey: "k1" }, db);
    await revertTask({ userId, taskId: task.id }, db);

    const again = await completeTask(
      { userId, taskId: task.id, idempotencyKey: "k2" },
      db,
    );

    expect(again.alreadyCompleted).toBe(false);
    expect(again.xp.global).toBe(50);
    // +50 accrual, -50 reversal, +50 new accrual.
    expect(await sumGlobalXp(db, userId)).toBe(50);

    const [t] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(t.status).toBe("completed");

    const completions = await db.select().from(taskCompletions);
    expect(completions).toHaveLength(2);
    expect(completions.filter((c) => c.revertedAt === null)).toHaveLength(1);
  });

  it("recomputes the streak on revert, preserving the best", async () => {
    const template = await createTemplate(db, {
      userId,
      skillId,
      title: "Кардио",
      baseXp: 20,
      difficulty: "normal",
      recurrenceType: "daily",
    });
    await ensureTasksForDate(userId, DATE, db);
    await ensureTasksForDate(userId, addDaysToDate(DATE, 1), db);

    const dayTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.templateId, template.id))
      .orderBy(asc(tasks.localDate));

    await completeTask({ userId, taskId: dayTasks[0].id, idempotencyKey: "a" }, db);
    const second = await completeTask(
      { userId, taskId: dayTasks[1].id, idempotencyKey: "b" },
      db,
    );
    expect(second.streak?.current).toBe(2);

    const reverted = await revertTask(
      { userId, taskId: dayTasks[1].id },
      db,
    );
    expect(reverted.streak?.current).toBe(1);
    expect(reverted.streak?.best).toBe(2);
  });

  it("rejects reverting a task with no active completion", async () => {
    const task = await oneOff();
    await expect(
      revertTask({ userId, taskId: task.id }, db),
    ).rejects.toMatchObject({ code: "nothing_to_revert" });
  });

  it("completes idempotently under concurrent requests", async () => {
    const task = await oneOff(50);

    const [a, b] = await Promise.all([
      completeTask({ userId, taskId: task.id, idempotencyKey: "k1" }, db),
      completeTask({ userId, taskId: task.id, idempotencyKey: "k2" }, db),
    ]);

    expect([a.alreadyCompleted, b.alreadyCompleted].sort()).toEqual([
      false,
      true,
    ]);
    expect(await sumGlobalXp(db, userId)).toBe(50);
    expect(await db.select().from(taskCompletions)).toHaveLength(1);
  });
});
