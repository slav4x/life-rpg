import { GameError } from "@/application/game/errors";
import { getDb, type DbClient } from "@/db/client";
import { upsertWeeklyFocus } from "@/db/repositories/weekly-focuses";
import type { WeeklyFocus } from "@/db/schema";
import { addDaysToDate, getIsoWeekday, getLocalDate } from "@/lib/dates/local-date";

export async function saveNextWeeklyFocus(
  userId: string,
  timezone: string,
  weekStart: string,
  focus: string,
  db: DbClient = getDb(),
): Promise<WeeklyFocus> {
  const today = getLocalDate(timezone);
  const expectedWeekStart = addDaysToDate(today, 8 - getIsoWeekday(today));
  if (weekStart !== expectedWeekStart) {
    throw new GameError("invalid_input", "Focus must target next week");
  }
  return upsertWeeklyFocus(db, userId, weekStart, focus.trim());
}
