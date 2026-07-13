import {
  and,
  asc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  sql,
} from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  attributes,
  questCompletions,
  taskCompletions,
  tasks,
  quests,
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
}

/** Completed tasks and still-pending past tasks in the current local week. */
export async function weeklyTaskSummary(
  db: DbClient,
  userId: string,
  fromDate: string,
  today: string,
): Promise<WeeklyTaskSummary> {
  const [row] = await db
    .select({
      completed: sql<string>`count(*) filter (where ${tasks.status} = 'completed')`,
      missed: sql<string>`count(*) filter (where ${tasks.status} = 'pending' and ${tasks.localDate} < ${today})`,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        gte(tasks.localDate, fromDate),
        lte(tasks.localDate, today),
      ),
    );
  return {
    completed: Number(row?.completed ?? 0),
    missed: Number(row?.missed ?? 0),
  };
}

export interface WeeklyQuestSummary {
  completed: number;
  overdue: Array<{ id: string; title: string; dueDate: string }>;
}

export async function weeklyQuestSummary(
  db: DbClient,
  userId: string,
  timezone: string,
  fromDate: string,
  today: string,
): Promise<WeeklyQuestSummary> {
  const completionDate = sql<string>`(${questCompletions.completedAt} at time zone ${timezone})::date`;
  const [[completedRow], overdueRows] = await Promise.all([
    db
      .select({ count: sql<string>`count(*)` })
      .from(questCompletions)
      .where(
        and(
          eq(questCompletions.userId, userId),
          isNull(questCompletions.revertedAt),
          gte(completionDate, fromDate),
          lte(completionDate, today),
        ),
      ),
    db
      .select({ id: quests.id, title: quests.title, dueDate: quests.dueDate })
      .from(quests)
      .where(
        and(
          eq(quests.userId, userId),
          eq(quests.status, "active"),
          isNotNull(quests.dueDate),
          lt(quests.dueDate, today),
        ),
      )
      .orderBy(asc(quests.dueDate)),
  ]);
  return {
    completed: Number(completedRow?.count ?? 0),
    overdue: overdueRows.flatMap((quest) =>
      quest.dueDate ? [{ ...quest, dueDate: quest.dueDate }] : [],
    ),
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
