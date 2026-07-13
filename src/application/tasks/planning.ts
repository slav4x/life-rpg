import { getDb, type DbClient } from "@/db/client";
import {
  countPendingTasksByDateThrough,
  listOverdueTasks,
  type PendingTaskDateCount,
} from "@/db/repositories/tasks";
import { TASK_BACKDATE_LIMIT_DAYS } from "@/application/tasks/completion-date-policy";
import { addDaysToDate } from "@/lib/dates/local-date";

export interface PlanningSummary {
  overdue: PendingTaskDateCount[];
  overdueTasks: Array<{
    id: string;
    title: string;
    localDate: string;
    skillName: string;
    priority: string;
    estimatedMinutes: number | null;
    templateId: string | null;
    questStepId: string | null;
    tooOldToComplete: boolean;
  }>;
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
  const [rows, overdueTaskRows] = await Promise.all([
    countPendingTasksByDateThrough(db, userId, addDaysToDate(today, 6)),
    listOverdueTasks(db, userId, today),
  ]);
  const overdue = rows.filter((row) => row.date < today);
  const nextSeven = rows.filter((row) => row.date >= today);
  const completionCutoff = addDaysToDate(today, -TASK_BACKDATE_LIMIT_DAYS);
  return {
    overdue,
    overdueTasks: overdueTaskRows.map(({ task, skill }) => ({
      id: task.id,
      title: task.title,
      localDate: task.localDate,
      skillName: skill.name,
      priority: task.priority,
      estimatedMinutes: task.estimatedMinutes,
      templateId: task.templateId,
      questStepId: task.questStepId,
      tooOldToComplete: task.localDate < completionCutoff,
    })),
    todayCount: rows.find((row) => row.date === today)?.count ?? 0,
    nextSeven,
    overdueCount: overdue.reduce((sum, row) => sum + row.count, 0),
    nextSevenCount: nextSeven.reduce((sum, row) => sum + row.count, 0),
  };
}
