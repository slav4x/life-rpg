import { getDb, type DbClient } from "@/db/client";
import {
  attributeDistribution,
  countCompletionsFrom,
  xpByLocalDate,
  type AttributeXp,
  type DailyXp,
} from "@/db/repositories/progress";
import { listStreaks } from "@/db/repositories/streaks";
import { listTemplates } from "@/db/repositories/task-templates";
import { listRecentXpEvents, type XpEvent } from "@/db/repositories/xp";
import { displayCurrentStreak } from "@/domain/game/streak";
import { addDaysToDate, getLocalDate } from "@/lib/dates/local-date";

export type ProgressPeriod = "7d" | "30d" | "all";

export function isProgressPeriod(value: string): value is ProgressPeriod {
  return value === "7d" || value === "30d" || value === "all";
}

// Cap the daily chart window so a long "all" history stays readable; the
// period totals are computed from the full data, not this window.
const CHART_MAX_DAYS = 90;

export interface ProgressData {
  period: ProgressPeriod;
  totalXp: number;
  completedTasks: number;
  streak: { current: number; best: number };
  daily: DailyXp[];
  attributes: AttributeXp[];
  recent: XpEvent[];
}

function laterDate(a: string, b: string): string {
  return a > b ? a : b;
}

function fillDailyRange(start: string, end: string, data: DailyXp[]): DailyXp[] {
  const byDate = new Map(data.map((d) => [d.date, d.xp]));
  const out: DailyXp[] = [];
  let cursor = start;
  while (cursor <= end) {
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

  const [dailyRaw, completedTasks, attributes, recent, streaks, templates] =
    await Promise.all([
      xpByLocalDate(db, userId, timezone, from, today),
      countCompletionsFrom(db, userId, from, today),
      attributeDistribution(db, userId, from, today),
      listRecentXpEvents(db, userId, 15),
      listStreaks(db, userId),
      listTemplates(db, userId),
    ]);

  // Totals reflect the full selected period; the chart is bounded to a window.
  const totalXp = dailyRaw.reduce((sum, d) => sum + d.xp, 0);
  const windowStart = laterDate(
    from ?? dailyRaw[0]?.date ?? today,
    addDaysToDate(today, -(CHART_MAX_DAYS - 1)),
  );
  const daily = fillDailyRange(windowStart, today, dailyRaw);

  const ruleByTemplate = new Map(
    templates.map((t) => [
      t.id,
      { recurrenceType: t.recurrenceType, weekdays: t.weekdays },
    ]),
  );
  let currentStreak = 0;
  let bestStreak = 0;
  for (const s of streaks) {
    const rule = ruleByTemplate.get(s.templateId) ?? {
      recurrenceType: "daily",
      weekdays: null,
    };
    currentStreak = Math.max(
      currentStreak,
      displayCurrentStreak(s.currentCount, rule, s.lastCompletedDate, today),
    );
    bestStreak = Math.max(bestStreak, s.bestCount);
  }

  return {
    period,
    totalXp,
    completedTasks,
    streak: { current: currentStreak, best: bestStreak },
    daily,
    attributes,
    recent,
  };
}
