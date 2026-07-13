import { asc, eq } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  achievements,
  userAchievements,
  type Achievement,
  type UserAchievement,
} from "@/db/schema";

export async function listAchievements(
  db: DbClient,
): Promise<Achievement[]> {
  return db.select().from(achievements).orderBy(asc(achievements.sortOrder));
}

export async function listUserAchievements(
  db: DbClient,
  userId: string,
): Promise<UserAchievement[]> {
  return db
    .select()
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));
}

export async function insertUserAchievements(
  db: DbClient,
  userId: string,
  achievementIds: string[],
  sourceId?: string | null,
): Promise<void> {
  if (achievementIds.length === 0) return;
  await db
    .insert(userAchievements)
    .values(
      achievementIds.map((achievementId) => ({
        userId,
        achievementId,
        sourceId: sourceId ?? null,
      })),
    )
    .onConflictDoNothing();
}
