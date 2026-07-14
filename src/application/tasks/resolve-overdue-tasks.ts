import { GameError } from "@/application/game/errors";
import { getDb, type Database } from "@/db/client";
import { updateTemplate } from "@/db/repositories/task-templates";
import {
  cancelPendingTasksFromTemplateDate,
  lockTasksByIds,
  setTaskStatus,
  updateTask,
} from "@/db/repositories/tasks";
import type { ResolveOverdueTasksInput } from "@/lib/validation/tasks";

export interface ResolveOverdueTasksResult {
  affected: number;
  pausedTemplates: number;
}

/** Resolve one or many overdue tasks atomically. */
export async function resolveOverdueTasks(
  userId: string,
  today: string,
  input: ResolveOverdueTasksInput,
  db: Database = getDb(),
): Promise<ResolveOverdueTasksResult> {
  return db.transaction(async (tx) => {
    const ids = [...input.taskIds].sort();
    const rows = await lockTasksByIds(tx, userId, ids);
    if (rows.length !== ids.length) {
      throw new GameError("task_not_found", "One or more tasks were not found");
    }
    if (rows.some((task) => task.status !== "pending")) {
      throw new GameError("task_not_pending", "Only pending tasks can be resolved");
    }
    if (rows.some((task) => task.localDate >= today)) {
      throw new GameError("task_not_overdue", "Only overdue tasks can be resolved");
    }

    if (input.action === "reschedule") {
      if (input.targetDate < today) {
        throw new GameError(
          "task_reschedule_past",
          "An overdue task must be moved to today or later",
        );
      }
      for (const task of rows) {
        // A moved missed occurrence becomes a one-off. Keeping templateId would
        // collide with the occurrence already materialised for the target date
        // and would incorrectly restore the original streak.
        await updateTask(tx, userId, task.id, {
          localDate: input.targetDate,
          templateId: null,
        });
      }
      return { affected: rows.length, pausedTemplates: 0 };
    }

    if (input.scope === "future") {
      if (rows.some((task) => !task.templateId)) {
        throw new GameError(
          "task_scope_invalid",
          "Only recurring tasks can pause future occurrences",
        );
      }
      const firstDateByTemplate = new Map<string, string>();
      for (const task of rows) {
        const templateId = task.templateId!;
        const current = firstDateByTemplate.get(templateId);
        if (!current || task.localDate < current) {
          firstDateByTemplate.set(templateId, task.localDate);
        }
      }
      for (const [templateId, fromDate] of firstDateByTemplate) {
        await updateTemplate(tx, userId, templateId, { isActive: false });
        await cancelPendingTasksFromTemplateDate(
          tx,
          userId,
          templateId,
          fromDate,
        );
      }
      return {
        affected: rows.length,
        pausedTemplates: firstDateByTemplate.size,
      };
    }

    for (const task of rows) await setTaskStatus(tx, task.id, "cancelled");
    return { affected: rows.length, pausedTemplates: 0 };
  });
}
