import { and, desc, eq, isNull } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  questCompletions,
  type QuestCompletion,
} from "@/db/schema";

export async function createQuestCompletion(
  db: DbClient,
  input: { userId: string; questId: string; rewardXp: number },
): Promise<QuestCompletion> {
  const [completion] = await db
    .insert(questCompletions)
    .values(input)
    .returning();
  return completion;
}

export async function findActiveQuestCompletion(
  db: DbClient,
  userId: string,
  questId: string,
): Promise<QuestCompletion | undefined> {
  const [completion] = await db
    .select()
    .from(questCompletions)
    .where(
      and(
        eq(questCompletions.userId, userId),
        eq(questCompletions.questId, questId),
        isNull(questCompletions.revertedAt),
      ),
    )
    .limit(1);
  return completion;
}

export async function findLatestQuestCompletion(
  db: DbClient,
  userId: string,
  questId: string,
): Promise<QuestCompletion | undefined> {
  const [completion] = await db
    .select()
    .from(questCompletions)
    .where(
      and(
        eq(questCompletions.userId, userId),
        eq(questCompletions.questId, questId),
      ),
    )
    .orderBy(desc(questCompletions.completedAt))
    .limit(1);
  return completion;
}

export async function markQuestCompletionReverted(
  db: DbClient,
  id: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(questCompletions)
    .set({ revertedAt: now })
    .where(and(eq(questCompletions.id, id), isNull(questCompletions.revertedAt)));
}
