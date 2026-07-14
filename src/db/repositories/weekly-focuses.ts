import { and, eq } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { weeklyFocuses, type WeeklyFocus } from "@/db/schema";

export async function getWeeklyFocus(
  db: DbClient,
  userId: string,
  weekStart: string,
): Promise<WeeklyFocus | undefined> {
  const [row] = await db
    .select()
    .from(weeklyFocuses)
    .where(
      and(
        eq(weeklyFocuses.userId, userId),
        eq(weeklyFocuses.weekStart, weekStart),
      ),
    )
    .limit(1);
  return row;
}

export async function upsertWeeklyFocus(
  db: DbClient,
  userId: string,
  weekStart: string,
  focus: string,
): Promise<WeeklyFocus> {
  const now = new Date();
  const [row] = await db
    .insert(weeklyFocuses)
    .values({ userId, weekStart, focus, updatedAt: now })
    .onConflictDoUpdate({
      target: [weeklyFocuses.userId, weeklyFocuses.weekStart],
      set: { focus, updatedAt: now },
    })
    .returning();
  return row;
}
