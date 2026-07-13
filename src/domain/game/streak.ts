import { addDaysToDate } from "@/lib/dates/local-date";

export interface StreakState {
  current: number;
  best: number;
  last: string | null;
}

/**
 * Compute a streak from the set of completion dates (SPEC §5.6). `current` is
 * the run of consecutive days ending at the latest date; `best` is the longest
 * run overall. Recomputing from actual completions keeps completion and revert
 * consistent and order-independent.
 */
export function computeStreakFromDates(dates: string[]): StreakState {
  const sorted = [...new Set(dates)].sort();
  if (sorted.length === 0) return { current: 0, best: 0, last: null };

  let run = 0;
  let best = 0;
  let prev: string | null = null;

  for (const date of sorted) {
    run = prev !== null && date === addDaysToDate(prev, 1) ? run + 1 : 1;
    if (run > best) best = run;
    prev = date;
  }

  return { current: run, best, last: sorted[sorted.length - 1] };
}
