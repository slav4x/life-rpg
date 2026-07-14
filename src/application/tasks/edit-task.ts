import { sql } from "drizzle-orm";

import { GameError } from "@/application/game/errors";
import { getDb, type Database, type DbClient } from "@/db/client";
import { getSkillById } from "@/db/repositories/skills";
import { updateTemplate } from "@/db/repositories/task-templates";
import {
  getTaskById,
  listTaskFocusPositions,
  setTaskStatus,
  updateTask,
  updateFuturePendingTasksFromTemplate,
  type UpdateTaskFields,
} from "@/db/repositories/tasks";
import type { Task } from "@/db/schema";
import { isDifficulty, isTaskPriority } from "@/domain/game/constants";

export interface EditTaskCommand {
  title?: string;
  description?: string | null;
  skillId?: string;
  localDate?: string;
  baseXp?: number;
  difficulty?: string;
  priority?: string;
  estimatedMinutes?: number | null;
  focused?: boolean;
  /** "future" also updates the source template for upcoming days (SPEC §6.3). */
  scope?: "this" | "future";
}

async function assertEditableSkill(
  db: DbClient,
  userId: string,
  skillId: string | undefined,
) {
  if (!skillId) return;
  const skill = await getSkillById(db, userId, skillId);
  if (!skill || skill.status !== "active") {
    throw new GameError("skill_not_found", "Skill not found");
  }
}

export async function editTask(
  userId: string,
  id: string,
  cmd: EditTaskCommand,
  db: Database = getDb(),
): Promise<Task> {
  return db.transaction(async (tx) => {
    const task = await getTaskById(tx, userId, id);
    if (!task) throw new GameError("task_not_found", "Task not found");
    if (task.status !== "pending") {
      throw new GameError("task_not_pending", "Only pending tasks can be edited");
    }
    if (cmd.difficulty && !isDifficulty(cmd.difficulty)) {
      throw new GameError("invalid_input", "Unknown difficulty");
    }
    if (cmd.priority && !isTaskPriority(cmd.priority)) {
      throw new GameError("invalid_input", "Unknown priority");
    }
    await assertEditableSkill(tx, userId, cmd.skillId);

    let focusPosition: number | null | undefined;
    if (cmd.focused !== undefined) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${userId}:${task.localDate}`}, 0))`,
      );
      if (cmd.focused && task.focusPosition == null) {
        const occupied = new Set(
          await listTaskFocusPositions(tx, userId, task.localDate),
        );
        const available = [1, 2, 3].find((position) => !occupied.has(position));
        if (!available) {
          throw new GameError("task_focus_limit", "Daily focus limit reached");
        }
        focusPosition = available;
      } else if (!cmd.focused) {
        focusPosition = null;
      }
    }

    const fields: UpdateTaskFields = {
      title: cmd.title,
      description: cmd.description,
      skillId: cmd.skillId,
      localDate: cmd.localDate,
      baseXp: cmd.baseXp,
      difficulty: cmd.difficulty,
      priority: cmd.priority,
      estimatedMinutes: cmd.estimatedMinutes,
      focusPosition,
    };

    if (cmd.scope === "future" && task.templateId) {
      const templateFields = {
        title: cmd.title,
        description: cmd.description,
        skillId: cmd.skillId,
        baseXp: cmd.baseXp,
        difficulty: cmd.difficulty,
        priority: cmd.priority,
        estimatedMinutes: cmd.estimatedMinutes,
      };
      await updateTemplate(tx, userId, task.templateId, templateFields);
      await updateFuturePendingTasksFromTemplate(
        tx,
        userId,
        task.templateId,
        task.localDate,
        templateFields,
      );
    }

    const updated = await updateTask(tx, userId, id, fields);
    if (!updated) throw new GameError("task_not_found", "Task not found");
    return updated;
  });
}

/**
 * Cancel a pending task without deleting its review/history record.
 */
export async function cancelTask(
  userId: string,
  id: string,
  db: DbClient = getDb(),
): Promise<void> {
  const task = await getTaskById(db, userId, id);
  if (!task) throw new GameError("task_not_found", "Task not found");
  if (task.status !== "pending") {
    throw new GameError("task_not_pending", "Only pending tasks can be removed");
  }

  await setTaskStatus(db, id, "cancelled");
}
