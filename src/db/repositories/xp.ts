import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import {
  taskCompletions,
  tasks,
  quests,
  userAttributes,
  userSkills,
  xpTransactions,
  type NewXpTransaction,
  type XpTransaction,
} from "@/db/schema";

export async function insertXpTransactions(
  db: DbClient,
  rows: NewXpTransaction[],
): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(xpTransactions).values(rows);
}

export async function listRecentTransactions(
  db: DbClient,
  userId: string,
  limit = 20,
): Promise<XpTransaction[]> {
  return db
    .select()
    .from(xpTransactions)
    .where(eq(xpTransactions.userId, userId))
    .orderBy(desc(xpTransactions.createdAt))
    .limit(limit);
}

export interface XpEvent {
  id: string;
  kind: "task" | "quest" | "reversal" | "adjustment";
  title: string;
  amount: number;
  skillXp: number;
  attributeXp: number;
  localDate: string | null;
  createdAt: string;
}

/** Group journal rows by their real-world source for human-readable history. */
export async function listRecentXpEvents(
  db: DbClient,
  userId: string,
  limit = 15,
): Promise<XpEvent[]> {
  const rows = await listRecentTransactions(db, userId, limit * 5);
  if (rows.length === 0) return [];

  const originalIds = rows.flatMap((row) =>
    row.reversalOfId ? [row.reversalOfId] : [],
  );
  const originals =
    originalIds.length > 0
      ? await db
          .select()
          .from(xpTransactions)
          .where(inArray(xpTransactions.id, originalIds))
      : [];
  const originalById = new Map(originals.map((row) => [row.id, row]));

  const taskCompletionIds = new Set<string>();
  const questIds = new Set<string>();
  for (const row of rows) {
    const source = row.reversalOfId
      ? originalById.get(row.reversalOfId)
      : row;
    if (!source) continue;
    if (source.sourceType === "task_completion") {
      taskCompletionIds.add(source.sourceId);
    } else if (source.sourceType === "quest_completion") {
      questIds.add(source.sourceId);
    }
  }

  const [taskSources, questSources] = await Promise.all([
    taskCompletionIds.size > 0
      ? db
          .select({
            completionId: taskCompletions.id,
            title: tasks.title,
            localDate: taskCompletions.localDate,
          })
          .from(taskCompletions)
          .innerJoin(tasks, eq(tasks.id, taskCompletions.taskId))
          .where(
            and(
              eq(taskCompletions.userId, userId),
              inArray(taskCompletions.id, [...taskCompletionIds]),
            ),
          )
      : Promise.resolve([]),
    questIds.size > 0
      ? db
          .select({ id: quests.id, title: quests.title })
          .from(quests)
          .where(
            and(eq(quests.userId, userId), inArray(quests.id, [...questIds])),
          )
      : Promise.resolve([]),
  ]);

  const taskByCompletion = new Map(
    taskSources.map((row) => [row.completionId, row]),
  );
  const questById = new Map(questSources.map((row) => [row.id, row]));
  const grouped = new Map<string, XpEvent>();

  for (const row of rows) {
    const original = row.reversalOfId
      ? originalById.get(row.reversalOfId)
      : undefined;
    const sourceType = original?.sourceType ?? row.sourceType;
    const sourceId = original?.sourceId ?? row.sourceId;
    const isReversal = row.sourceType === "reversal";
    const key = `${isReversal ? "reversal" : sourceType}:${sourceId}`;
    const task =
      sourceType === "task_completion"
        ? taskByCompletion.get(sourceId)
        : undefined;
    const quest =
      sourceType === "quest_completion" ? questById.get(sourceId) : undefined;

    let event = grouped.get(key);
    if (!event) {
      event = {
        id: key,
        kind: isReversal
          ? "reversal"
          : sourceType === "task_completion"
            ? "task"
            : sourceType === "quest_completion"
              ? "quest"
              : "adjustment",
        title: task?.title ?? quest?.title ?? "Корректировка XP",
        amount: 0,
        skillXp: 0,
        attributeXp: 0,
        localDate: task?.localDate ?? null,
        createdAt: row.createdAt.toISOString(),
      };
      grouped.set(key, event);
    }

    if (row.scope === "global") event.amount += row.amount;
    else if (row.scope === "skill") event.skillXp += row.amount;
    else if (row.scope === "attribute") event.attributeXp += row.amount;
  }

  return [...grouped.values()].slice(0, limit);
}

export async function listSkillTransactions(
  db: DbClient,
  userId: string,
  skillId: string,
  limit = 20,
): Promise<XpTransaction[]> {
  return db
    .select()
    .from(xpTransactions)
    .where(
      and(
        eq(xpTransactions.userId, userId),
        eq(xpTransactions.skillId, skillId),
        eq(xpTransactions.scope, "skill"),
      ),
    )
    .orderBy(desc(xpTransactions.createdAt))
    .limit(limit);
}

/** Whether the skill has ever received XP, including subsequently reverted XP. */
export async function hasSkillXpHistory(
  db: DbClient,
  userId: string,
  skillId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: xpTransactions.id })
    .from(xpTransactions)
    .where(
      and(
        eq(xpTransactions.userId, userId),
        eq(xpTransactions.skillId, skillId),
        eq(xpTransactions.scope, "skill"),
        gt(xpTransactions.amount, 0),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** The accrual transactions written for a task completion (for reversal). */
export async function getTransactionsBySource(
  db: DbClient,
  userId: string,
  sourceId: string,
): Promise<XpTransaction[]> {
  return db
    .select()
    .from(xpTransactions)
    .where(
      and(
        eq(xpTransactions.userId, userId),
        eq(xpTransactions.sourceId, sourceId),
        eq(xpTransactions.sourceType, "task_completion"),
      ),
    );
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
