import { and, asc, eq, gte, isNull, sql } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { attributes, taskCompletions, userAttributes } from "@/db/schema";

export interface DailyXp {
  date: string;
  xp: number;
}

/** XP per local day from non-reverted completions, optionally since a date. */
export async function xpByLocalDate(
  db: DbClient,
  userId: string,
  fromDate?: string,
): Promise<DailyXp[]> {
  const conditions = [
    eq(taskCompletions.userId, userId),
    isNull(taskCompletions.revertedAt),
  ];
  if (fromDate) conditions.push(gte(taskCompletions.localDate, fromDate));

  const rows = await db
    .select({
      date: taskCompletions.localDate,
      xp: sql<string>`sum(${taskCompletions.finalXp})`,
    })
    .from(taskCompletions)
    .where(and(...conditions))
    .groupBy(taskCompletions.localDate)
    .orderBy(asc(taskCompletions.localDate));
  return rows.map((r) => ({ date: r.date, xp: Number(r.xp) }));
}

export async function countCompletionsFrom(
  db: DbClient,
  userId: string,
  fromDate?: string,
): Promise<number> {
  const conditions = [
    eq(taskCompletions.userId, userId),
    isNull(taskCompletions.revertedAt),
  ];
  if (fromDate) conditions.push(gte(taskCompletions.localDate, fromDate));

  const [row] = await db
    .select({ count: sql<string>`count(*)` })
    .from(taskCompletions)
    .where(and(...conditions));
  return Number(row?.count ?? 0);
}

export interface AttributeXp {
  code: string;
  name: string;
  xp: number;
}

/** All six attributes with cached XP (0 when not started), sorted. */
export async function attributeDistribution(
  db: DbClient,
  userId: string,
): Promise<AttributeXp[]> {
  const rows = await db
    .select({
      code: attributes.code,
      name: attributes.name,
      xp: userAttributes.xp,
    })
    .from(attributes)
    .leftJoin(
      userAttributes,
      and(
        eq(userAttributes.attributeId, attributes.id),
        eq(userAttributes.userId, userId),
      ),
    )
    .orderBy(asc(attributes.sortOrder));
  return rows.map((r) => ({ code: r.code, name: r.name, xp: r.xp ?? 0 }));
}
