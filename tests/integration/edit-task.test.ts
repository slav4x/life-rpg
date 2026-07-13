import { eq, sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { completeTask } from "@/application/tasks/complete-task";
import { cancelTask, editTask } from "@/application/tasks/edit-task";
import { ensureTasksForDate } from "@/application/tasks/ensure-daily-tasks";
import { ensureAttributes, listAttributes } from "@/db/repositories/attributes";
import { createSkill } from "@/db/repositories/skills";
import { createTemplate } from "@/db/repositories/task-templates";
import { updateUserTemplate } from "@/application/templates/manage-template";
import { createTask } from "@/db/repositories/tasks";
import * as schema from "@/db/schema";
import { taskTemplates, tasks, users } from "@/db/schema";
import { addDaysToDate } from "@/lib/dates/local-date";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("edit & cancel task (integration)", () => {
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
      sql`truncate table xp_transactions, task_completions, streaks, tasks, task_templates, quest_steps, quests, user_achievements, user_skills, user_attributes, skills, sessions, users restart identity cascade`,
    );
    const [user] = await db
      .insert(users)
      .values({ telegramId: 760_000_001n, firstName: "E" })
      .returning();
    userId = user.id;
    skillId = (
      await createSkill(db, {
        userId,
        attributeId: (await listAttributes(db)).find((a) => a.code === "mind")!.id,
        name: "Frontend",
      })
    ).id;
  });

  async function oneOff() {
    return createTask(db, {
      userId,
      skillId,
      title: "Старое",
      localDate: DATE,
      baseXp: 20,
      difficulty: "normal",
    });
  }

  it("edits a pending task", async () => {
    const task = await oneOff();

    await editTask(userId, task.id, { title: "Новое", baseXp: 40 }, db);

    const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(row.title).toBe("Новое");
    expect(row.baseXp).toBe(40);
  });

  it("refuses to edit a completed task", async () => {
    const task = await oneOff();
    await completeTask({ userId, taskId: task.id, idempotencyKey: "a" }, db);

    await expect(
      editTask(userId, task.id, { title: "x" }, db),
    ).rejects.toMatchObject({ code: "task_not_pending" });
  });

  it("with scope=future also updates the template", async () => {
    const template = await createTemplate(db, {
      userId,
      skillId,
      title: "Зарядка",
      baseXp: 20,
      difficulty: "normal",
      recurrenceType: "daily",
    });
    for (const offset of [0, 1, 2, 3]) {
      await ensureTasksForDate(userId, addDaysToDate(DATE, offset), db);
    }
    const materialised = await db
      .select()
      .from(tasks)
      .where(eq(tasks.templateId, template.id))
      .orderBy(tasks.localDate);
    await db
      .update(tasks)
      .set({ status: "completed" })
      .where(eq(tasks.id, materialised[2].id));
    await db
      .update(tasks)
      .set({ status: "cancelled" })
      .where(eq(tasks.id, materialised[3].id));

    await editTask(
      userId,
      materialised[0].id,
      { baseXp: 55, estimatedMinutes: 25, scope: "future" },
      db,
    );

    const [t] = await db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.id, template.id));
    expect(t.baseXp).toBe(55);
    expect(t.estimatedMinutes).toBe(25);
    const updatedTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.templateId, template.id))
      .orderBy(tasks.localDate);
    expect(updatedTasks.map((row) => row.baseXp)).toEqual([55, 55, 20, 20]);
    expect(updatedTasks.map((row) => row.estimatedMinutes)).toEqual([
      25,
      25,
      null,
      null,
    ]);
  });

  it("cancels pending materialised tasks outside updated boundaries", async () => {
    const template = await createTemplate(db, {
      userId,
      skillId,
      title: "Границы",
      baseXp: 20,
      difficulty: "normal",
      recurrenceType: "daily",
      startsOn: DATE,
    });
    for (const offset of [0, 1, 2]) {
      await ensureTasksForDate(userId, addDaysToDate(DATE, offset), db);
    }

    await updateUserTemplate(
      userId,
      template.id,
      { startsOn: addDaysToDate(DATE, 1), endsOn: addDaysToDate(DATE, 1) },
      db,
    );

    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.templateId, template.id))
      .orderBy(tasks.localDate);
    expect(rows.map((row) => row.status)).toEqual([
      "cancelled",
      "pending",
      "cancelled",
    ]);
  });

  it("deletes a one-off task but cancels a template task", async () => {
    const off = await oneOff();
    await cancelTask(userId, off.id, db);
    expect(
      await db.select().from(tasks).where(eq(tasks.id, off.id)),
    ).toHaveLength(0);

    const template = await createTemplate(db, {
      userId,
      skillId,
      title: "Шаблон",
      baseXp: 20,
      difficulty: "normal",
      recurrenceType: "daily",
    });
    await ensureTasksForDate(userId, DATE, db);
    const [tplTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.templateId, template.id));

    await cancelTask(userId, tplTask.id, db);
    const [row] = await db.select().from(tasks).where(eq(tasks.id, tplTask.id));
    expect(row.status).toBe("cancelled");
  });
});
