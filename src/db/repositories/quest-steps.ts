import { and, asc, eq, sql } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { questSteps, quests, type QuestStep } from "@/db/schema";

export interface StepCounts {
  questId: string;
  total: number;
  completed: number;
}

/** Total and completed step counts per quest, for list progress. */
export async function stepCountsByQuest(
  db: DbClient,
  userId: string,
): Promise<StepCounts[]> {
  const rows = await db
    .select({
      questId: questSteps.questId,
      total: sql<string>`count(*)`,
      completed: sql<string>`count(*) filter (where ${questSteps.completedAt} is not null)`,
    })
    .from(questSteps)
    .innerJoin(quests, eq(quests.id, questSteps.questId))
    .where(eq(quests.userId, userId))
    .groupBy(questSteps.questId);
  return rows.map((r) => ({
    questId: r.questId,
    total: Number(r.total),
    completed: Number(r.completed),
  }));
}

export interface NewStepInput {
  title: string;
  description?: string | null;
  isRequired?: boolean;
  sortOrder: number;
}

export async function createSteps(
  db: DbClient,
  questId: string,
  steps: NewStepInput[],
): Promise<void> {
  if (steps.length === 0) return;
  await db.insert(questSteps).values(
    steps.map((s) => ({
      questId,
      title: s.title,
      description: s.description ?? null,
      isRequired: s.isRequired ?? true,
      sortOrder: s.sortOrder,
    })),
  );
}

export async function listSteps(
  db: DbClient,
  questId: string,
): Promise<QuestStep[]> {
  return db
    .select()
    .from(questSteps)
    .where(eq(questSteps.questId, questId))
    .orderBy(asc(questSteps.sortOrder));
}

/** A step joined with its owning quest id (ownership check via the user). */
export async function getStepForUser(
  db: DbClient,
  userId: string,
  stepId: string,
): Promise<QuestStep | undefined> {
  const [row] = await db
    .select({ step: questSteps })
    .from(questSteps)
    .innerJoin(quests, eq(quests.id, questSteps.questId))
    .where(and(eq(questSteps.id, stepId), eq(quests.userId, userId)))
    .limit(1);
  return row?.step;
}

export async function setStepCompleted(
  db: DbClient,
  stepId: string,
  completedAt: Date | null,
): Promise<void> {
  await db
    .update(questSteps)
    .set({ completedAt, updatedAt: new Date() })
    .where(eq(questSteps.id, stepId));
}
