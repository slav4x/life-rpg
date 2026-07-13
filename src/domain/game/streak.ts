import { addDaysToDate, getIsoWeekday } from "@/lib/dates/local-date";

import { templateAppliesOnWeekday, type RecurrenceRule } from "./recurrence";

export interface StreakState {
  current: number;
  best: number;
  last: string | null;
}

function isScheduled(rule: RecurrenceRule, date: string): boolean {
  return (
    rule.recurrenceType === "daily" ||
    templateAppliesOnWeekday(rule, getIsoWeekday(date))
  );
}

/** Scheduled occurrence immediately before `date` (searches up to two weeks). */
export function previousScheduledDate(
  rule: RecurrenceRule,
  date: string,
): string {
  for (let i = 1; i <= 14; i++) {
    const candidate = addDaysToDate(date, -i);
    if (isScheduled(rule, candidate)) return candidate;
  }
  return addDaysToDate(date, -1);
}

/** Scheduled occurrence immediately after `date`. */
export function nextScheduledDate(rule: RecurrenceRule, date: string): string {
  for (let i = 1; i <= 14; i++) {
    const candidate = addDaysToDate(date, i);
    if (isScheduled(rule, candidate)) return candidate;
  }
  return addDaysToDate(date, 1);
}

/**
 * Schedule-aware streak (SPEC §5.6): the run of consecutive completed scheduled
 * occurrences. For a daily rule this equals consecutive calendar days; for the
 * weekdays rule it follows the schedule (e.g. Mon/Wed/Fri counts as consecutive).
 * `current` is the run ending at the last completion; adjust it to "today" with
 * {@link displayCurrentStreak}.
 */
export function computeStreak(
  dates: string[],
  rule: RecurrenceRule,
): StreakState {
  const sorted = [...new Set(dates)].sort();
  if (sorted.length === 0) return { current: 0, best: 0, last: null };

  let run = 0;
  let best = 0;
  let prev: string | null = null;
  for (const date of sorted) {
    run =
      prev !== null && previousScheduledDate(rule, date) === prev ? run + 1 : 1;
    if (run > best) best = run;
    prev = date;
  }

  return { current: run, best, last: sorted[sorted.length - 1] };
}

/** Whether a streak whose last completion is `last` is still alive on `today`. */
export function isStreakAlive(
  rule: RecurrenceRule,
  last: string | null,
  today: string,
): boolean {
  if (!last) return false;
  if (last >= today) return true;
  // Broken once a scheduled occurrence between `last` and today was missed.
  return nextScheduledDate(rule, last) >= today;
}

/** Current streak adjusted to today — 0 once a scheduled occurrence is missed. */
export function displayCurrentStreak(
  current: number,
  rule: RecurrenceRule,
  last: string | null,
  today: string,
): number {
  return isStreakAlive(rule, last, today) ? current : 0;
}
