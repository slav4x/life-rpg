import {
  and,
  asc,
  eq,
  gte,
  isNotNull,
  isNull,
  lte,
  sql,
} from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  attributes,
  questCompletions,
  taskCompletions,
  tasks,
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

export interface WeeklyTaskSummary {
  completed: number;
  missed: number;
  pendingMissed: number;
  dismissedMissed: number;
}

/**
 * Week outcome. A missed task is a dated occurrence whose day has passed and
 * which is still pending or was explicitly cancelled/skipped.
 */
export async function weeklyTaskSummary(
  db: DbClient,
  userId: string,
  fromDate: string,
  toDate: string,
  missedThrough: string,
): Promise<WeeklyTaskSummary> {
  const [row] = await db
    .select({
      completed: sql<string>`count(*) filter (where ${tasks.status} = 'completed')`,
      pendingMissed: sql<string>`count(*) filter (where ${tasks.status} = 'pending' and ${tasks.localDate} <= ${missedThrough})`,
      dismissedMissed: sql<string>`count(*) filter (where ${tasks.status} = 'cancelled' and ${tasks.localDate} <= ${missedThrough})`,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        gte(tasks.localDate, fromDate),
        lte(tasks.localDate, toDate),
      ),
    );
  const pendingMissed = Number(row?.pendingMissed ?? 0);
  const dismissedMissed = Number(row?.dismissedMissed ?? 0);
  return {
    completed: Number(row?.completed ?? 0),
    missed: pendingMissed + dismissedMissed,
    pendingMissed,
    dismissedMissed,
  };
}

export interface WeeklyQuestSummary {
  completed: number;
}

export async function weeklyQuestSummary(
  db: DbClient,
  userId: string,
  timezone: string,
  fromDate: string,
  today: string,
): Promise<WeeklyQuestSummary> {
  const completionDate = sql<string>`(${questCompletions.completedAt} at time zone ${timezone})::date`;
  const [completedRow] = await db
    .select({ count: sql<string>`count(*)` })
    .from(questCompletions)
    .where(
      and(
        eq(questCompletions.userId, userId),
        isNull(questCompletions.revertedAt),
        gte(completionDate, fromDate),
        lte(completionDate, today),
      ),
    );
  return {
    completed: Number(completedRow?.count ?? 0),
  };
}

export async function templateCompletionCounts(
  db: DbClient,
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<Array<{ templateId: string; count: number }>> {
  const rows = await db
    .select({
      templateId: tasks.templateId,
      count: sql<string>`count(*)`,
    })
    .from(taskCompletions)
    .innerJoin(tasks, eq(tasks.id, taskCompletions.taskId))
    .where(
      and(
        eq(taskCompletions.userId, userId),
        isNull(taskCompletions.revertedAt),
        isNotNull(tasks.templateId),
        gte(taskCompletions.localDate, fromDate),
        lte(taskCompletions.localDate, toDate),
      ),
    )
    .groupBy(tasks.templateId);
  return rows.flatMap((row) =>
    row.templateId
      ? [{ templateId: row.templateId, count: Number(row.count) }]
      : [],
  );
}

export interface TemplateTaskOutcome {
  templateId: string;
  scheduled: number;
  missed: number;
}

/** Materialised recurring occurrences and misses in a bounded window. */
export async function templateTaskOutcomes(
  db: DbClient,
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<TemplateTaskOutcome[]> {
  const rows = await db
    .select({
      templateId: tasks.templateId,
      scheduled: sql<string>`count(*)`,
      missed: sql<string>`count(*) filter (where ${tasks.status} in ('pending', 'cancelled'))`,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        isNotNull(tasks.templateId),
        gte(tasks.localDate, fromDate),
        lte(tasks.localDate, toDate),
      ),
    )
    .groupBy(tasks.templateId);
  return rows.flatMap((row) =>
    row.templateId
      ? [
          {
            templateId: row.templateId,
            scheduled: Number(row.scheduled),
            missed: Number(row.missed),
          },
        ]
      : [],
  );
}

/** Active completion dates per recurring template through a local date. */
export async function templateCompletionDatesThrough(
  db: DbClient,
  userId: string,
  throughDate: string,
): Promise<Array<{ templateId: string; date: string }>> {
  const rows = await db
    .select({ templateId: tasks.templateId, date: taskCompletions.localDate })
    .from(taskCompletions)
    .innerJoin(tasks, eq(tasks.id, taskCompletions.taskId))
    .where(
      and(
        eq(taskCompletions.userId, userId),
        isNull(taskCompletions.revertedAt),
        isNotNull(tasks.templateId),
        lte(taskCompletions.localDate, throughDate),
      ),
    )
    .orderBy(asc(taskCompletions.localDate));
  return rows.flatMap((row) =>
    row.templateId ? [{ templateId: row.templateId, date: row.date }] : [],
  );
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
