import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  attributes,
  questCompletions,
  taskCompletions,
  xpTransactions,
} from "@/db/schema";

export interface DailyXp {
  date: string;
  xp: number;
}

/** XP per local day from non-reverted completions, optionally since a date. */
export async function xpByLocalDate(
  db: DbClient,
  userId: string,
  timezone: string,
  fromDate?: string,
  toDate?: string,
): Promise<DailyXp[]> {
  const conditions = [
    eq(taskCompletions.userId, userId),
    isNull(taskCompletions.revertedAt),
  ];
  if (fromDate) conditions.push(gte(taskCompletions.localDate, fromDate));
  if (toDate) conditions.push(lte(taskCompletions.localDate, toDate));

  const taskRows = await db
    .select({
      date: taskCompletions.localDate,
      xp: sql<string>`sum(${taskCompletions.finalXp})`,
    })
    .from(taskCompletions)
    .where(and(...conditions))
    .groupBy(taskCompletions.localDate)
    .orderBy(asc(taskCompletions.localDate));
  const questDate = sql<string>`(${questCompletions.completedAt} at time zone ${timezone})::date`;
  const questConditions = [
    eq(questCompletions.userId, userId),
    isNull(questCompletions.revertedAt),
  ];
  if (fromDate) questConditions.push(gte(questDate, fromDate));
  if (toDate) questConditions.push(lte(questDate, toDate));

  const questRows = await db
    .select({ date: questDate, xp: sql<string>`sum(${questCompletions.rewardXp})` })
    .from(questCompletions)
    .where(and(...questConditions))
    .groupBy(sql`1`)
    .orderBy(sql`1 asc`);

  const byDate = new Map<string, number>();
  for (const row of [...taskRows, ...questRows]) {
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + Number(row.xp));
  }
  return [...byDate.entries()]
    .map(([date, xp]) => ({ date, xp }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function countCompletionsFrom(
  db: DbClient,
  userId: string,
  fromDate?: string,
  toDate?: string,
): Promise<number> {
  const conditions = [
    eq(taskCompletions.userId, userId),
    isNull(taskCompletions.revertedAt),
  ];
  if (fromDate) conditions.push(gte(taskCompletions.localDate, fromDate));
  if (toDate) conditions.push(lte(taskCompletions.localDate, toDate));

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
  fromDate?: string,
  toDate?: string,
): Promise<AttributeXp[]> {
  const completionConditions = [
    eq(taskCompletions.id, xpTransactions.sourceId),
    eq(taskCompletions.userId, userId),
    isNull(taskCompletions.revertedAt),
  ];
  if (fromDate) {
    completionConditions.push(gte(taskCompletions.localDate, fromDate));
  }
  if (toDate) {
    completionConditions.push(lte(taskCompletions.localDate, toDate));
  }

  const rows = await db
    .select({
      code: attributes.code,
      name: attributes.name,
      xp: sql<string>`coalesce(sum(${xpTransactions.amount}) filter (where ${taskCompletions.id} is not null), 0)`,
    })
    .from(attributes)
    .leftJoin(
      xpTransactions,
      and(
        eq(xpTransactions.attributeId, attributes.id),
        eq(xpTransactions.userId, userId),
        eq(xpTransactions.scope, "attribute"),
        eq(xpTransactions.sourceType, "task_completion"),
      ),
    )
    .leftJoin(taskCompletions, and(...completionConditions))
    .groupBy(attributes.id, attributes.code, attributes.name, attributes.sortOrder)
    .orderBy(asc(attributes.sortOrder));
  return rows.map((r) => ({ code: r.code, name: r.name, xp: Number(r.xp) }));
}
