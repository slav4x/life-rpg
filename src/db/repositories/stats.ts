import { and, eq, gt, isNull, sql } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  streaks,
  taskCompletions,
  userAttributes,
  userSkills,
} from "@/db/schema";

export async function countCompletedTasks(
  db: DbClient,
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<string>`count(*)` })
    .from(taskCompletions)
    .where(
      and(
        eq(taskCompletions.userId, userId),
        isNull(taskCompletions.revertedAt),
      ),
    );
  return Number(row?.count ?? 0);
}

export async function maxCurrentStreak(
  db: DbClient,
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ max: sql<string>`coalesce(max(${streaks.currentCount}), 0)` })
    .from(streaks)
    .where(eq(streaks.userId, userId));
  return Number(row?.max ?? 0);
}

export async function maxSkillXp(db: DbClient, userId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<string>`coalesce(max(${userSkills.xp}), 0)` })
    .from(userSkills)
    .where(eq(userSkills.userId, userId));
  return Number(row?.max ?? 0);
}

export async function countStartedAttributes(
  db: DbClient,
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<string>`count(*)` })
    .from(userAttributes)
    .where(and(eq(userAttributes.userId, userId), gt(userAttributes.xp, 0)));
  return Number(row?.count ?? 0);
}
