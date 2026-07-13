import { and, asc, desc, eq } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { skills, tasks, type Skill, type Task } from "@/db/schema";

export interface CreateTaskInput {
  userId: string;
  skillId: string;
  title: string;
  description?: string | null;
  localDate: string;
  baseXp: number;
  difficulty: string;
  estimatedMinutes?: number | null;
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
    .where(and(eq(tasks.userId, userId), eq(tasks.localDate, localDate)))
    .orderBy(asc(tasks.status), desc(tasks.createdAt));
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
