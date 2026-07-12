import { and, eq, isNull, sql } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  taskCompletions,
  userAttributes,
  userSkills,
  xpTransactions,
  type NewXpTransaction,
} from "@/db/schema";

export async function insertXpTransactions(
  db: DbClient,
  rows: NewXpTransaction[],
): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(xpTransactions).values(rows);
}

/** Total confirmed global XP for a user, from the journal (SPEC §5.1). */
export async function sumGlobalXp(
  db: DbClient,
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${xpTransactions.amount}), 0)`,
    })
    .from(xpTransactions)
    .where(
      and(eq(xpTransactions.userId, userId), eq(xpTransactions.scope, "global")),
    );
  return Number(row?.total ?? 0);
}

/** Sum of XP from non-reverted completions on a given local day. */
export async function sumXpForDate(
  db: DbClient,
  userId: string,
  localDate: string,
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${taskCompletions.finalXp}), 0)`,
    })
    .from(taskCompletions)
    .where(
      and(
        eq(taskCompletions.userId, userId),
        eq(taskCompletions.localDate, localDate),
        isNull(taskCompletions.revertedAt),
      ),
    );
  return Number(row?.total ?? 0);
}

/** Add XP to the cached skill total, returning the new total. */
export async function incrementUserSkillXp(
  db: DbClient,
  userId: string,
  skillId: string,
  delta: number,
): Promise<number> {
  const [row] = await db
    .insert(userSkills)
    .values({ userId, skillId, xp: delta, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [userSkills.userId, userSkills.skillId],
      set: { xp: sql`${userSkills.xp} + ${delta}`, updatedAt: new Date() },
    })
    .returning({ xp: userSkills.xp });
  return row.xp;
}

export async function getUserSkillXp(
  db: DbClient,
  userId: string,
  skillId: string,
): Promise<number> {
  const [row] = await db
    .select({ xp: userSkills.xp })
    .from(userSkills)
    .where(and(eq(userSkills.userId, userId), eq(userSkills.skillId, skillId)))
    .limit(1);
  return row?.xp ?? 0;
}

export async function getUserAttributeXp(
  db: DbClient,
  userId: string,
  attributeId: string,
): Promise<number> {
  const [row] = await db
    .select({ xp: userAttributes.xp })
    .from(userAttributes)
    .where(
      and(
        eq(userAttributes.userId, userId),
        eq(userAttributes.attributeId, attributeId),
      ),
    )
    .limit(1);
  return row?.xp ?? 0;
}

/** Add XP to the cached attribute total, returning the new total. */
export async function incrementUserAttributeXp(
  db: DbClient,
  userId: string,
  attributeId: string,
  delta: number,
): Promise<number> {
  const [row] = await db
    .insert(userAttributes)
    .values({ userId, attributeId, xp: delta, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [userAttributes.userId, userAttributes.attributeId],
      set: { xp: sql`${userAttributes.xp} + ${delta}`, updatedAt: new Date() },
    })
    .returning({ xp: userAttributes.xp });
  return row.xp;
}
