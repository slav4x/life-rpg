import { and, eq, sql } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { streaks, type Streak } from "@/db/schema";

export async function listStreaks(
  db: DbClient,
  userId: string,
): Promise<Streak[]> {
  return db.select().from(streaks).where(eq(streaks.userId, userId));
}

export async function getStreak(
  db: DbClient,
  userId: string,
  templateId: string,
): Promise<Streak | undefined> {
  const [row] = await db
    .select()
    .from(streaks)
    .where(and(eq(streaks.userId, userId), eq(streaks.templateId, templateId)))
    .limit(1);
  return row;
}

export interface UpsertStreakInput {
  userId: string;
  templateId: string;
  current: number;
  best: number;
  last: string | null;
}

export async function upsertStreak(
  db: DbClient,
  input: UpsertStreakInput,
): Promise<Streak> {
  const now = new Date();
  const [row] = await db
    .insert(streaks)
    .values({
      userId: input.userId,
      templateId: input.templateId,
      currentCount: input.current,
      bestCount: input.best,
      lastCompletedDate: input.last,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [streaks.userId, streaks.templateId],
      set: {
        currentCount: input.current,
        // Never lose an all-time record, even after a revert.
        bestCount: sql`greatest(${streaks.bestCount}, ${input.best})`,
        lastCompletedDate: input.last,
        updatedAt: now,
      },
    })
    .returning();
  return row;
}
