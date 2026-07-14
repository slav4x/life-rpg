import { getPlanningSummary } from "@/application/tasks/planning";
import { getDb, type DbClient } from "@/db/client";
import { listAttributes } from "@/db/repositories/attributes";
import {
  attributeDistribution,
  countCompletionsFrom,
  templateCompletionCounts,
  templateCompletionDatesThrough,
  templateTaskOutcomes,
  weeklyQuestSummary,
  weeklyTaskSummary,
  xpByLocalDate,
  type AttributeXp,
  type DailyXp,
  type WeeklyTaskSummary,
} from "@/db/repositories/progress";
import { stepCountsByQuest } from "@/db/repositories/quest-steps";
import { listQuests } from "@/db/repositories/quests";
import { listActiveSkills } from "@/db/repositories/skills";
import { listStreaks } from "@/db/repositories/streaks";
import { listTemplates } from "@/db/repositories/task-templates";
import { getWeeklyFocus } from "@/db/repositories/weekly-focuses";
import { listRecentXpEvents, type XpEvent } from "@/db/repositories/xp";
import { computeStreak, displayCurrentStreak } from "@/domain/game/streak";
import {
  addDaysToDate,
  getIsoWeekday,
  getLocalDate,
} from "@/lib/dates/local-date";

export type ProgressPeriod = "7d" | "30d" | "all";

export function isProgressPeriod(value: string): value is ProgressPeriod {
  return value === "7d" || value === "30d" || value === "all";
}

const CHART_MAX_DAYS = 90;
const STALLED_QUEST_DAYS = 14;
const RECURRENCE_REVIEW_DAYS = 28;

export interface WeekMetrics {
  from: string;
  to: string;
  xp: number;
  completedTasks: number;
  missedTasks: number;
  pendingMissedTasks: number;
  dismissedMissedTasks: number;
  completedQuests: number;
  activeStreaks: number;
}

export interface ProgressData {
  period: ProgressPeriod;
  totalXp: number;
  completedTasks: number;
  streak: { current: number; best: number };
  daily: DailyXp[];
  attributes: AttributeXp[];
  recent: XpEvent[];
  skills: Array<{ id: string; name: string; attributeId: string }>;
  questAttributes: Array<{ id: string; name: string }>;
  templateStreaks: Array<{
    templateId: string;
    title: string;
    current: number;
    best: number;
    weekStart: number;
    weeklyChange: number;
    weeklyCompletions: number;
  }>;
  week: WeekMetrics & {
    directions: AttributeXp[];
    previous: WeekMetrics;
    actionableMissedTasks: Awaited<
      ReturnType<typeof getPlanningSummary>
    >["overdueTasks"];
    stalledQuests: Array<{
      id: string;
      title: string;
      dueDate: string | null;
      reason: "overdue" | "no_progress";
      requiredCompleted: number;
      requiredTotal: number;
    }>;
    problemTemplates: Array<{
      id: string;
      title: string;
      skillId: string;
      skillName: string;
      baseXp: number;
      difficulty: string;
      priority: string;
      description: string | null;
      recurrenceType: string;
      weekdays: number[] | null;
      estimatedMinutes: number | null;
      startsOn: string;
      endsOn: string | null;
      scheduled: number;
      missed: number;
      missRate: number;
    }>;
  };
  nextWeek: {
    from: string;
    to: string;
    focus: string;
  };
}

function laterDate(a: string, b: string): string {
  return a > b ? a : b;
}

function fillDailyRange(start: string, end: string, data: DailyXp[]): DailyXp[] {
  const byDate = new Map(data.map((day) => [day.date, day.xp]));
  const out: DailyXp[] = [];
  let cursor = start;
  while (cursor <= end) {
    out.push({ date: cursor, xp: byDate.get(cursor) ?? 0 });
    cursor = addDaysToDate(cursor, 1);
  }
  return out;
}

function sumXp(days: DailyXp[]): number {
  return days.reduce((sum, day) => sum + day.xp, 0);
}

function filterDailyRange(
  days: DailyXp[],
  from: string | undefined,
  to: string,
): DailyXp[] {
  return days.filter((day) => (!from || day.date >= from) && day.date <= to);
}

function taskMetrics(
  from: string,
  to: string,
  xp: number,
  tasks: WeeklyTaskSummary,
  completedQuests: number,
  activeStreaks: number,
): WeekMetrics {
  return {
    from,
    to,
    xp,
    completedTasks: tasks.completed,
    missedTasks: tasks.missed,
    pendingMissedTasks: tasks.pendingMissed,
    dismissedMissedTasks: tasks.dismissedMissed,
    completedQuests,
    activeStreaks,
  };
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
  const yesterday = addDaysToDate(today, -1);
  const previousWeekStart = addDaysToDate(weekStart, -7);
  const previousWeekEnd = addDaysToDate(weekStart, -1);
  const nextWeekStart = addDaysToDate(weekStart, 7);
  const nextWeekEnd = addDaysToDate(nextWeekStart, 6);
  const recurrenceReviewStart = addDaysToDate(today, -(RECURRENCE_REVIEW_DAYS - 1));
  const xpRangeStart =
    from === undefined || from <= previousWeekStart
      ? from
      : previousWeekStart;

  const [
    xpRange,
    completedTasks,
    attributes,
    recent,
    streaks,
    templates,
    currentWeekTasks,
    previousWeekTasks,
    currentWeekQuests,
    previousWeekQuests,
    weeklyAttributes,
    weeklyTemplateCounts,
    completionDates,
    recurrenceOutcomes,
    planning,
    quests,
    questStepCounts,
    nextFocus,
    activeSkills,
    questAttributes,
  ] = await Promise.all([
    xpByLocalDate(db, userId, timezone, xpRangeStart, today),
    countCompletionsFrom(db, userId, from, today),
    attributeDistribution(db, userId, from, today),
    listRecentXpEvents(db, userId, 15),
    listStreaks(db, userId),
    listTemplates(db, userId),
    weeklyTaskSummary(db, userId, weekStart, today, yesterday),
    weeklyTaskSummary(
      db,
      userId,
      previousWeekStart,
      previousWeekEnd,
      previousWeekEnd,
    ),
    weeklyQuestSummary(db, userId, timezone, weekStart, today),
    weeklyQuestSummary(
      db,
      userId,
      timezone,
      previousWeekStart,
      previousWeekEnd,
    ),
    attributeDistribution(db, userId, weekStart, today),
    templateCompletionCounts(db, userId, weekStart, today),
    templateCompletionDatesThrough(db, userId, today),
    templateTaskOutcomes(db, userId, recurrenceReviewStart, yesterday),
    getPlanningSummary(userId, today, db),
    listQuests(db, userId),
    stepCountsByQuest(db, userId),
    getWeeklyFocus(db, userId, nextWeekStart),
    listActiveSkills(db, userId),
    listAttributes(db),
  ]);

  const dailyRaw = filterDailyRange(xpRange, from, today);
  const currentWeekXp = filterDailyRange(xpRange, weekStart, today);
  const previousWeekXp = filterDailyRange(
    xpRange,
    previousWeekStart,
    previousWeekEnd,
  );
  const totalXp = sumXp(dailyRaw);
  const windowStart = laterDate(
    from ?? dailyRaw[0]?.date ?? today,
    addDaysToDate(today, -(CHART_MAX_DAYS - 1)),
  );
  const daily = fillDailyRange(windowStart, today, dailyRaw);

  const completionDatesByTemplate = new Map<string, string[]>();
  for (const completion of completionDates) {
    const dates = completionDatesByTemplate.get(completion.templateId) ?? [];
    dates.push(completion.date);
    completionDatesByTemplate.set(completion.templateId, dates);
  }
  const weeklyCountByTemplate = new Map(
    weeklyTemplateCounts.map((item) => [item.templateId, item.count]),
  );
  const streakByTemplate = new Map(streaks.map((streak) => [streak.templateId, streak]));
  const activeTemplates = templates.filter(
    (template) => template.isActive && template.archivedAt === null,
  );

  let currentStreak = 0;
  let bestStreak = 0;
  let currentActiveStreaks = 0;
  let previousActiveStreaks = 0;
  const templateStreaks: ProgressData["templateStreaks"] = [];
  for (const template of templates) {
    const rule = {
      recurrenceType: template.recurrenceType,
      weekdays: template.weekdays,
    };
    const dates = completionDatesByTemplate.get(template.id) ?? [];
    const startDate = addDaysToDate(weekStart, -1);
    const startState = computeStreak(
      dates.filter((date) => date <= startDate),
      rule,
    );
    const endState = computeStreak(dates, rule);
    const previousState = computeStreak(
      dates.filter((date) => date <= previousWeekEnd),
      rule,
    );
    const weekStartCurrent = displayCurrentStreak(
      startState.current,
      rule,
      startState.last,
      startDate,
    );
    const current = displayCurrentStreak(
      endState.current,
      rule,
      endState.last,
      today,
    );
    const previousCurrent = displayCurrentStreak(
      previousState.current,
      rule,
      previousState.last,
      previousWeekEnd,
    );
    const persisted = streakByTemplate.get(template.id);
    const best = Math.max(persisted?.bestCount ?? 0, endState.best);
    currentStreak = Math.max(currentStreak, current);
    bestStreak = Math.max(bestStreak, best);
    if (template.isActive && template.archivedAt === null) {
      if (current > 0 && template.startsOn <= today) currentActiveStreaks += 1;
      if (previousCurrent > 0 && template.startsOn <= previousWeekEnd) {
        previousActiveStreaks += 1;
      }
    }
    if (persisted || dates.length > 0) {
      templateStreaks.push({
        templateId: template.id,
        title: template.title,
        current,
        best,
        weekStart: weekStartCurrent,
        weeklyChange: current - weekStartCurrent,
        weeklyCompletions: weeklyCountByTemplate.get(template.id) ?? 0,
      });
    }
  }
  templateStreaks.sort(
    (left, right) =>
      right.current - left.current ||
      right.best - left.best ||
      left.title.localeCompare(right.title, "ru"),
  );

  const questCountsById = new Map(
    questStepCounts.map((count) => [count.questId, count]),
  );
  const stalledCutoff = addDaysToDate(today, -STALLED_QUEST_DAYS);
  const stalledQuests: ProgressData["week"]["stalledQuests"] = quests
    .filter((quest) => quest.status === "active")
    .flatMap((quest) => {
      const counts = questCountsById.get(quest.id) ?? {
        requiredTotal: 0,
        requiredCompleted: 0,
      };
      const overdue = quest.dueDate !== null && quest.dueDate < today;
      const createdDate = quest.createdAt.toISOString().slice(0, 10);
      const withoutProgress =
        counts.requiredCompleted === 0 && createdDate <= stalledCutoff;
      if (!overdue && !withoutProgress) return [];
      return [
        {
          id: quest.id,
          title: quest.title,
          dueDate: quest.dueDate,
          reason: overdue ? ("overdue" as const) : ("no_progress" as const),
          requiredCompleted: counts.requiredCompleted,
          requiredTotal: counts.requiredTotal,
        },
      ];
    })
    .sort((left, right) => {
      if (left.reason !== right.reason) return left.reason === "overdue" ? -1 : 1;
      return (left.dueDate ?? "9999-12-31").localeCompare(
        right.dueDate ?? "9999-12-31",
      );
    });

  const templateById = new Map(activeTemplates.map((template) => [template.id, template]));
  const skillById = new Map(activeSkills.map((skill) => [skill.id, skill]));
  const problemTemplates: ProgressData["week"]["problemTemplates"] =
    recurrenceOutcomes
      .filter(
        (outcome) =>
          outcome.scheduled >= 3 &&
          outcome.missed >= 2 &&
          outcome.missed / outcome.scheduled >= 0.4,
      )
      .flatMap((outcome) => {
        const template = templateById.get(outcome.templateId);
        if (!template) return [];
        return [
          {
            id: template.id,
            title: template.title,
            skillId: template.skillId,
            skillName: skillById.get(template.skillId)?.name ?? "Архивный навык",
            baseXp: template.baseXp,
            difficulty: template.difficulty,
            priority: template.priority,
            description: template.description,
            recurrenceType: template.recurrenceType,
            weekdays: template.weekdays,
            estimatedMinutes: template.estimatedMinutes,
            startsOn: template.startsOn,
            endsOn: template.endsOn,
            scheduled: outcome.scheduled,
            missed: outcome.missed,
            missRate: Math.round((outcome.missed / outcome.scheduled) * 100),
          },
        ];
      })
      .sort((left, right) => right.missRate - left.missRate || right.missed - left.missed);

  return {
    period,
    totalXp,
    completedTasks,
    streak: { current: currentStreak, best: bestStreak },
    daily,
    attributes,
    recent,
    skills: activeSkills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      attributeId: skill.attributeId,
    })),
    questAttributes: questAttributes.map((attribute) => ({
      id: attribute.id,
      name: attribute.name,
    })),
    templateStreaks,
    week: {
      ...taskMetrics(
        weekStart,
        today,
        sumXp(currentWeekXp),
        currentWeekTasks,
        currentWeekQuests.completed,
        currentActiveStreaks,
      ),
      directions: weeklyAttributes
        .filter((attribute) => attribute.xp > 0)
        .sort((left, right) => right.xp - left.xp)
        .slice(0, 3),
      previous: taskMetrics(
        previousWeekStart,
        previousWeekEnd,
        sumXp(previousWeekXp),
        previousWeekTasks,
        previousWeekQuests.completed,
        previousActiveStreaks,
      ),
      actionableMissedTasks: planning.overdueTasks,
      stalledQuests,
      problemTemplates,
    },
    nextWeek: {
      from: nextWeekStart,
      to: nextWeekEnd,
      focus: nextFocus?.focus ?? "",
    },
  };
}
