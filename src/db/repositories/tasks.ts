import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  questSteps,
  skills,
  tasks,
  type Skill,
  type Task,
} from "@/db/schema";

export interface CreateTaskInput {
  userId: string;
  skillId: string;
  title: string;
  description?: string | null;
  localDate: string;
  baseXp: number;
  difficulty: string;
  priority?: string;
  estimatedMinutes?: number | null;
  questStepId?: string | null;
}

export async function createTask(
  db: DbClient,
  input: CreateTaskInput,
): Promise<Task> {
  const [task] = await db
    .insert(tasks)
    .values({
      userId: input.userId,
      skillId: input.skillId,
      title: input.title,
      description: input.description ?? null,
      localDate: input.localDate,
      baseXp: input.baseXp,
      difficulty: input.difficulty,
      priority: input.priority ?? "normal",
      estimatedMinutes: input.estimatedMinutes ?? null,
      questStepId: input.questStepId ?? null,
    })
    .returning();
  return task;
}

export interface TemplateTaskRow {
  userId: string;
  templateId: string;
  skillId: string;
  title: string;
  description: string | null;
  localDate: string;
  baseXp: number;
  difficulty: string;
  priority: string;
  estimatedMinutes: number | null;
}

/**
 * Insert template-derived tasks, skipping any that already exist for the day.
 * Relies on the partial unique index, so it is safe under concurrency (SPEC §12).
 */
export async function insertTasksFromTemplates(
  db: DbClient,
  rows: TemplateTaskRow[],
): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(tasks).values(rows).onConflictDoNothing();
}

export interface TaskWithSkill {
  task: Task;
  skill: Skill;
}

/** Tasks for a given local day, ordered by state and explicit priority. */
export async function listTasksForDate(
  db: DbClient,
  userId: string,
  localDate: string,
): Promise<TaskWithSkill[]> {
  return db
    .select({ task: tasks, skill: skills })
    .from(tasks)
    .innerJoin(skills, eq(skills.id, tasks.skillId))
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.localDate, localDate),
        ne(tasks.status, "cancelled"),
      ),
    )
    .orderBy(
      asc(tasks.status),
      sql`case ${tasks.priority} when 'high' then 0 when 'normal' then 1 else 2 end`,
      desc(tasks.createdAt),
    );
}

/** All unresolved tasks before today, oldest and highest-priority first. */
export async function listOverdueTasks(
  db: DbClient,
  userId: string,
  today: string,
): Promise<TaskWithSkill[]> {
  return db
    .select({ task: tasks, skill: skills })
    .from(tasks)
    .innerJoin(skills, eq(skills.id, tasks.skillId))
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.status, "pending"),
        lt(tasks.localDate, today),
      ),
    )
    .orderBy(
      asc(tasks.localDate),
      sql`case ${tasks.priority} when 'high' then 0 when 'normal' then 1 else 2 end`,
      asc(tasks.createdAt),
    );
}

export async function listRecentTasksBySkill(
  db: DbClient,
  userId: string,
  skillId: string,
  limit = 10,
): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.skillId, skillId)))
    .orderBy(desc(tasks.createdAt))
    .limit(limit);
}

/** Fetch and row-lock a task for the completion transaction (SPEC §11). */
export async function lockTask(
  db: DbClient,
  userId: string,
  taskId: string,
): Promise<Task | undefined> {
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1)
    .for("update");
  return task;
}

export async function getTaskById(
  db: DbClient,
  userId: string,
  id: string,
): Promise<Task | undefined> {
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .limit(1);
  return task;
}

/** Lock a bounded set in stable order for an atomic bulk operation. */
export async function lockTasksByIds(
  db: DbClient,
  userId: string,
  ids: string[],
): Promise<Task[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), inArray(tasks.id, ids)))
    .orderBy(asc(tasks.id))
    .for("update");
}

export async function getActiveTaskByQuestStepId(
  db: DbClient,
  userId: string,
  questStepId: string,
): Promise<Task | undefined> {
  const [task] = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.questStepId, questStepId),
        ne(tasks.status, "cancelled"),
      ),
    )
    .limit(1);
  return task;
}

export interface QuestStepTaskLink {
  stepId: string;
  taskId: string;
  status: string;
  localDate: string;
}

export async function listTaskLinksForQuest(
  db: DbClient,
  userId: string,
  questId: string,
): Promise<QuestStepTaskLink[]> {
  return db
    .select({
      stepId: tasks.questStepId,
      taskId: tasks.id,
      status: tasks.status,
      localDate: tasks.localDate,
    })
    .from(tasks)
    .innerJoin(questSteps, eq(questSteps.id, tasks.questStepId))
    .where(
      and(
        eq(tasks.userId, userId),
        eq(questSteps.questId, questId),
        ne(tasks.status, "cancelled"),
      ),
    )
    .then((rows) =>
      rows.flatMap((row) =>
        row.stepId ? [{ ...row, stepId: row.stepId }] : [],
      ),
    );
}

export interface UpdateTaskFields {
  title?: string;
  description?: string | null;
  templateId?: string | null;
  skillId?: string;
  localDate?: string;
  baseXp?: number;
  difficulty?: string;
  priority?: string;
  estimatedMinutes?: number | null;
  focusPosition?: number | null;
}

/** Focus positions already occupied by pending tasks for a local day. */
export async function listTaskFocusPositions(
  db: DbClient,
  userId: string,
  localDate: string,
): Promise<number[]> {
  const rows = await db
    .select({ position: tasks.focusPosition })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.localDate, localDate),
        eq(tasks.status, "pending"),
        sql`${tasks.focusPosition} is not null`,
      ),
    )
    .orderBy(asc(tasks.focusPosition));
  return rows.flatMap((row) =>
    row.position == null ? [] : [row.position],
  );
}

export async function updateTask(
  db: DbClient,
  userId: string,
  id: string,
  fields: UpdateTaskFields,
): Promise<Task | undefined> {
  const [task] = await db
    .update(tasks)
    .set({ ...fields, updatedAt: new Date() })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning();
  return task;
}

/** Update already-materialised pending occurrences after the edited task date. */
export async function updateFuturePendingTasksFromTemplate(
  db: DbClient,
  userId: string,
  templateId: string,
  afterDate: string,
  fields: Omit<UpdateTaskFields, "localDate">,
): Promise<void> {
  await db
    .update(tasks)
    .set({ ...fields, updatedAt: new Date() })
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.templateId, templateId),
        eq(tasks.status, "pending"),
        gt(tasks.localDate, afterDate),
      ),
    );
}

/** Cancel pending materialised tasks that no longer fit template boundaries. */
export async function cancelPendingTasksOutsideTemplateRange(
  db: DbClient,
  userId: string,
  templateId: string,
  startsOn: string,
  endsOn: string | null,
): Promise<void> {
  const outside = endsOn
    ? or(lt(tasks.localDate, startsOn), gt(tasks.localDate, endsOn))
    : lt(tasks.localDate, startsOn);
  await db
    .update(tasks)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.templateId, templateId),
        eq(tasks.status, "pending"),
        outside,
      ),
    );
}

/** Cancel this and later pending occurrences when a repetition is paused. */
export async function cancelPendingTasksFromTemplateDate(
  db: DbClient,
  userId: string,
  templateId: string,
  fromDate: string,
): Promise<void> {
  await db
    .update(tasks)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.templateId, templateId),
        eq(tasks.status, "pending"),
        gte(tasks.localDate, fromDate),
      ),
    );
}

export interface PendingTaskDateCount {
  date: string;
  count: number;
}

/** Pending tasks grouped by date up to the planning horizon. */
export async function countPendingTasksByDateThrough(
  db: DbClient,
  userId: string,
  throughDate: string,
): Promise<PendingTaskDateCount[]> {
  const rows = await db
    .select({
      date: tasks.localDate,
      count: sql<string>`count(*)`,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.status, "pending"),
        lte(tasks.localDate, throughDate),
      ),
    )
    .groupBy(tasks.localDate)
    .orderBy(asc(tasks.localDate));
  return rows.map((row) => ({ date: row.date, count: Number(row.count) }));
}

export async function deleteTask(
  db: DbClient,
  userId: string,
  id: string,
): Promise<void> {
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
}

export async function setTaskStatus(
  db: DbClient,
  taskId: string,
  status: string,
): Promise<void> {
  await db
    .update(tasks)
    .set({
      status,
      focusPosition: status === "pending" ? undefined : null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));
}
