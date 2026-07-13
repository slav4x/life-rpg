import { getDb, type DbClient } from "@/db/client";
import {
  countPendingTasksByDateThrough,
  type PendingTaskDateCount,
} from "@/db/repositories/tasks";
import { addDaysToDate } from "@/lib/dates/local-date";

export interface PlanningSummary {
  overdue: PendingTaskDateCount[];
  todayCount: number;
  nextSeven: PendingTaskDateCount[];
  overdueCount: number;
  nextSevenCount: number;
}

export async function getPlanningSummary(
  userId: string,
  today: string,
  db: DbClient = getDb(),
): Promise<PlanningSummary> {
  const rows = await countPendingTasksByDateThrough(
    db,
    userId,
    addDaysToDate(today, 6),
  );
  const overdue = rows.filter((row) => row.date < today);
  const nextSeven = rows.filter((row) => row.date >= today);
  return {
    overdue,
    todayCount: rows.find((row) => row.date === today)?.count ?? 0,
    nextSeven,
    overdueCount: overdue.reduce((sum, row) => sum + row.count, 0),
    nextSevenCount: nextSeven.reduce((sum, row) => sum + row.count, 0),
  };
}
