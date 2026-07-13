import { and, asc, desc, eq, ne } from "drizzle-orm";

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

/** Tasks for a given local day, newest first, joined with their skill. */
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
    .orderBy(asc(tasks.status), desc(tasks.createdAt));
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
  skillId?: string;
  localDate?: string;
  baseXp?: number;
  difficulty?: string;
  estimatedMinutes?: number | null;
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
    .set({ status, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}
