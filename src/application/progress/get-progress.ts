import { getDb, type DbClient } from "@/db/client";
import {
  attributeDistribution,
  countCompletionsFrom,
  xpByLocalDate,
  type AttributeXp,
  type DailyXp,
} from "@/db/repositories/progress";
import { streakSummary } from "@/db/repositories/stats";
import { listRecentTransactions } from "@/db/repositories/xp";
import { addDaysToDate, getLocalDate } from "@/lib/dates/local-date";

export type ProgressPeriod = "7d" | "30d" | "all";

export function isProgressPeriod(value: string): value is ProgressPeriod {
  return value === "7d" || value === "30d" || value === "all";
}

export interface ProgressTransaction {
  amount: number;
  scope: string;
  sourceType: string;
  createdAt: string;
}

export interface ProgressData {
  period: ProgressPeriod;
  totalXp: number;
  completedTasks: number;
  streak: { current: number; best: number };
  daily: DailyXp[];
  attributes: AttributeXp[];
  recent: ProgressTransaction[];
}

function fillDailyRange(start: string, end: string, data: DailyXp[]): DailyXp[] {
  const byDate = new Map(data.map((d) => [d.date, d.xp]));
  const out: DailyXp[] = [];
  let cursor = start;
  for (let i = 0; i < 400 && cursor <= end; i++) {
    out.push({ date: cursor, xp: byDate.get(cursor) ?? 0 });
    cursor = addDaysToDate(cursor, 1);
  }
  return out;
}

export async function getProgressData(
  userId: string,
  period: ProgressPeriod,
  timezone: string,
  db: DbClient = getDb(),
): Promise<ProgressData> {
  const today = getLocalDate(timezone);
  const from =
    period === "7d"
      ? addDaysToDate(today, -6)
      : period === "30d"
        ? addDaysToDate(today, -29)
        : undefined;

  const [dailyRaw, completedTasks, streak, attributes, recent] =
    await Promise.all([
      xpByLocalDate(db, userId, from),
      countCompletionsFrom(db, userId, from),
      streakSummary(db, userId),
      attributeDistribution(db, userId),
      listRecentTransactions(db, userId, 15),
    ]);

  const start = from ?? dailyRaw[0]?.date ?? today;
  const daily = fillDailyRange(start, today, dailyRaw);

  return {
    period,
    totalXp: daily.reduce((sum, d) => sum + d.xp, 0),
    completedTasks,
    streak,
    daily,
    attributes,
    recent: recent.map((t) => ({
      amount: t.amount,
      scope: t.scope,
      sourceType: t.sourceType,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}
