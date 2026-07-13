/**
 * Local calendar date helpers (SPEC §8.4). Timestamps are stored in UTC; the
 * user's local day is derived from their IANA timezone.
 */

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Local date as `YYYY-MM-DD` in the given timezone. */
export function getLocalDate(timeZone: string, at: Date = new Date()): string {
  if (!isValidTimeZone(timeZone)) {
    throw new Error(`Invalid timezone: ${timeZone}`);
  }
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** ISO weekday for a `YYYY-MM-DD` date: 1 = Monday … 7 = Sunday. */
export function getIsoWeekday(dateStr: string): number {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  return day === 0 ? 7 : day;
}

/** Add (or subtract) whole days to a `YYYY-MM-DD` date, returning `YYYY-MM-DD`. */
export function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** True when the string is a well-formed calendar date (`YYYY-MM-DD`). */
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
