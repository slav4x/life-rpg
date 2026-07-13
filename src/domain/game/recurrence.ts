export type RecurrenceType = "daily" | "weekdays";

export const RECURRENCE_TYPES: RecurrenceType[] = ["daily", "weekdays"];

export function isRecurrenceType(value: string): value is RecurrenceType {
  return value === "daily" || value === "weekdays";
}

export interface RecurrenceRule {
  recurrenceType: string;
  /** ISO weekdays (1=Mon .. 7=Sun) for the "weekdays" rule. */
  weekdays: number[] | null;
}

/** Whether a template should produce a task on the given ISO weekday (SPEC §12). */
export function templateAppliesOnWeekday(
  rule: RecurrenceRule,
  isoWeekday: number,
): boolean {
  if (rule.recurrenceType === "daily") return true;
  if (rule.recurrenceType === "weekdays") {
    return (rule.weekdays ?? []).includes(isoWeekday);
  }
  return false;
}
