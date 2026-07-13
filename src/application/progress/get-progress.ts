import { getDb, type DbClient } from "@/db/client";
import {
  attributeDistribution,
  countCompletionsFrom,
  templateCompletionCounts,
  weeklyQuestSummary,
  weeklyTaskSummary,
  xpByLocalDate,
  type AttributeXp,
  type DailyXp,
} from "@/db/repositories/progress";
import { listStreaks } from "@/db/repositories/streaks";
import { listTemplates } from "@/db/repositories/task-templates";
import { listRecentXpEvents, type XpEvent } from "@/db/repositories/xp";
import { displayCurrentStreak } from "@/domain/game/streak";
import {
  addDaysToDate,
  getIsoWeekday,
  getLocalDate,
} from "@/lib/dates/local-date";

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
  templateStreaks: Array<{
    templateId: string;
    title: string;
    current: number;
    best: number;
    weeklyCompletions: number;
  }>;
  week: {
    from: string;
    to: string;
    xp: number;
    completedTasks: number;
    missedTasks: number;
    completedQuests: number;
    overdueQuests: Array<{ id: string; title: string; dueDate: string }>;
    directions: AttributeXp[];
  };
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
  const weekStart = addDaysToDate(today, 1 - getIsoWeekday(today));

  const [
    dailyRaw,
    completedTasks,
    attributes,
    recent,
    streaks,
    templates,
    weeklyXpRaw,
    weeklyTasks,
    weeklyQuests,
    weeklyAttributes,
    weeklyTemplateCounts,
  ] =
    await Promise.all([
      xpByLocalDate(db, userId, timezone, from, today),
      countCompletionsFrom(db, userId, from, today),
      attributeDistribution(db, userId, from, today),
      listRecentXpEvents(db, userId, 15),
      listStreaks(db, userId),
      listTemplates(db, userId),
      xpByLocalDate(db, userId, timezone, weekStart, today),
      weeklyTaskSummary(db, userId, weekStart, today),
      weeklyQuestSummary(db, userId, timezone, weekStart, today),
      attributeDistribution(db, userId, weekStart, today),
      templateCompletionCounts(db, userId, weekStart, today),
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
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const weeklyCountByTemplate = new Map(
    weeklyTemplateCounts.map((item) => [item.templateId, item.count]),
  );
  const templateStreaks: ProgressData["templateStreaks"] = [];
  for (const s of streaks) {
    const rule = ruleByTemplate.get(s.templateId) ?? {
      recurrenceType: "daily",
      weekdays: null,
    };
    const current = displayCurrentStreak(
      s.currentCount,
      rule,
      s.lastCompletedDate,
      today,
    );
    currentStreak = Math.max(currentStreak, current);
    bestStreak = Math.max(bestStreak, s.bestCount);
    const template = templateById.get(s.templateId);
    if (template) {
      templateStreaks.push({
        templateId: s.templateId,
        title: template.title,
        current,
        best: s.bestCount,
        weeklyCompletions: weeklyCountByTemplate.get(s.templateId) ?? 0,
      });
    }
  }
  templateStreaks.sort(
    (left, right) =>
      right.current - left.current ||
      right.best - left.best ||
      left.title.localeCompare(right.title, "ru"),
  );

  return {
    period,
    totalXp,
    completedTasks,
    streak: { current: currentStreak, best: bestStreak },
    daily,
    attributes,
    recent,
    templateStreaks,
    week: {
      from: weekStart,
      to: today,
      xp: weeklyXpRaw.reduce((sum, day) => sum + day.xp, 0),
      completedTasks: weeklyTasks.completed,
      missedTasks: weeklyTasks.missed,
      completedQuests: weeklyQuests.completed,
      overdueQuests: weeklyQuests.overdue,
      directions: weeklyAttributes
        .filter((attribute) => attribute.xp > 0)
        .sort((left, right) => right.xp - left.xp)
        .slice(0, 3),
    },
  };
}
