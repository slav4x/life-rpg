import { GameError } from "@/application/game/errors";
import { ensureTasksForDate } from "@/application/tasks/ensure-daily-tasks";
import { getDb, type Database } from "@/db/client";
import { isUniqueConstraintViolation } from "@/db/errors";
import { getSkillById } from "@/db/repositories/skills";
import { createTemplate } from "@/db/repositories/task-templates";
import type { TaskTemplate } from "@/db/schema";
import { isDifficulty } from "@/domain/game/constants";
import { isRecurrenceType } from "@/domain/game/recurrence";

export interface CreateTemplateCommand {
  userId: string;
  skillId: string;
  title: string;
  description?: string;
  baseXp: number;
  difficulty: string;
  recurrenceType: string;
  weekdays?: number[];
  estimatedMinutes?: number;
  endsOn?: string;
  /** The user's local date, so today's task is materialised immediately. */
  localDate: string;
}

/** Create a recurring template and materialise today's task (SPEC §6.3). */
export async function createUserTemplate(
  cmd: CreateTemplateCommand,
  db: Database = getDb(),
): Promise<TaskTemplate> {
  if (!isDifficulty(cmd.difficulty)) {
    throw new GameError("invalid_input", "Unknown difficulty");
  }
  if (!isRecurrenceType(cmd.recurrenceType)) {
    throw new GameError("invalid_input", "Unknown recurrence");
  }
  if (
    cmd.recurrenceType === "weekdays" &&
    (!cmd.weekdays || cmd.weekdays.length === 0)
  ) {
    throw new GameError("invalid_input", "Select at least one weekday");
  }
  if (cmd.endsOn && cmd.endsOn < cmd.localDate) {
    throw new GameError("invalid_input", "Template end date precedes start date");
  }

  const skill = await getSkillById(db, cmd.userId, cmd.skillId);
  if (!skill || skill.status !== "active") {
    throw new GameError("skill_not_found", "Skill not found");
  }

  let template: TaskTemplate;
  try {
    template = await createTemplate(db, {
      userId: cmd.userId,
      skillId: cmd.skillId,
      title: cmd.title,
      description: cmd.description ?? null,
      baseXp: cmd.baseXp,
      difficulty: cmd.difficulty,
      recurrenceType: cmd.recurrenceType,
      weekdays: cmd.recurrenceType === "weekdays" ? (cmd.weekdays ?? null) : null,
      estimatedMinutes: cmd.estimatedMinutes ?? null,
      startsOn: cmd.localDate,
      endsOn: cmd.endsOn ?? null,
    });
  } catch (error) {
    if (
      isUniqueConstraintViolation(
        error,
        "task_templates_user_live_title_unique",
      )
    ) {
      throw new GameError(
        "duplicate_template",
        "Non-archived template title already exists",
      );
    }
    throw error;
  }

  await ensureTasksForDate(cmd.userId, cmd.localDate, db);
  return template;
}
