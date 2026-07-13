import { and, desc, eq, isNotNull } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { quests, type Quest } from "@/db/schema";

export interface CreateQuestInput {
  userId: string;
  attributeId?: string | null;
  title: string;
  description?: string | null;
  type: string;
  status?: string;
  rewardXp: number;
  dueDate?: string | null;
  manualCompletion?: boolean;
}

export async function createQuest(
  db: DbClient,
  input: CreateQuestInput,
): Promise<Quest> {
  const [quest] = await db
    .insert(quests)
    .values({
      userId: input.userId,
      attributeId: input.attributeId ?? null,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      status: input.status ?? "active",
      rewardXp: input.rewardXp,
      dueDate: input.dueDate ?? null,
      manualCompletion: input.manualCompletion ?? true,
    })
    .returning();
  return quest;
}

export async function listQuests(
  db: DbClient,
  userId: string,
): Promise<Quest[]> {
  return db
    .select()
    .from(quests)
    .where(eq(quests.userId, userId))
    .orderBy(desc(quests.createdAt));
}

export async function getQuestById(
  db: DbClient,
  userId: string,
  id: string,
): Promise<Quest | undefined> {
  const [quest] = await db
    .select()
    .from(quests)
    .where(and(eq(quests.id, id), eq(quests.userId, userId)))
    .limit(1);
  return quest;
}

/** Fetch and row-lock a quest for the completion transaction (SPEC §11). */
export async function lockQuest(
  db: DbClient,
  userId: string,
  id: string,
): Promise<Quest | undefined> {
  const [quest] = await db
    .select()
    .from(quests)
    .where(and(eq(quests.id, id), eq(quests.userId, userId)))
    .limit(1)
    .for("update");
  return quest;
}

export interface UpdateQuestFields {
  title?: string;
  description?: string | null;
  type?: string;
  status?: string;
  attributeId?: string | null;
  rewardXp?: number;
  dueDate?: string | null;
  manualCompletion?: boolean;
}

export async function updateQuest(
  db: DbClient,
  userId: string,
  id: string,
  fields: UpdateQuestFields,
): Promise<Quest | undefined> {
  const [quest] = await db
    .update(quests)
    .set({ ...fields, updatedAt: new Date() })
    .where(and(eq(quests.id, id), eq(quests.userId, userId)))
    .returning();
  return quest;
}

export async function markQuestCompleted(
  db: DbClient,
  id: string,
  completedAt: Date = new Date(),
): Promise<void> {
  await db
    .update(quests)
    .set({ status: "completed", completedAt, updatedAt: completedAt })
    .where(eq(quests.id, id));
}

export async function markQuestActive(
  db: DbClient,
  id: string,
  updatedAt: Date = new Date(),
): Promise<void> {
  await db
    .update(quests)
    .set({ status: "active", completedAt: null, updatedAt })
    .where(eq(quests.id, id));
}

export async function countCompletedQuests(
  db: DbClient,
  userId: string,
): Promise<number> {
  const rows = await db
    .select({ id: quests.id })
    .from(quests)
    .where(and(eq(quests.userId, userId), isNotNull(quests.completedAt)));
  return rows.length;
}
