import { GameError } from "@/application/game/errors";
import { getDb, type Database } from "@/db/client";
import { isUniqueConstraintViolation } from "@/db/errors";
import { getSkillById } from "@/db/repositories/skills";
import {
  archiveTemplate,
  getTemplateById,
  listTemplates,
  restoreTemplate,
  updateTemplate,
  type UpdateTemplateFields,
} from "@/db/repositories/task-templates";
import { cancelPendingTasksOutsideTemplateRange } from "@/db/repositories/tasks";
import type { TaskTemplate } from "@/db/schema";

export async function listUserTemplates(
  userId: string,
): Promise<TaskTemplate[]> {
  return listTemplates(getDb(), userId);
}

export async function updateUserTemplate(
  userId: string,
  id: string,
  fields: UpdateTemplateFields,
  db: Database = getDb(),
): Promise<TaskTemplate> {
  // Switching to a daily recurrence clears any leftover weekday list.
  const normalized: UpdateTemplateFields =
    fields.recurrenceType === "daily" ? { ...fields, weekdays: null } : fields;

  let template: TaskTemplate | undefined;
  try {
    template = await db.transaction(async (tx) => {
      const current = await getTemplateById(tx, userId, id);
      if (!current) {
        throw new GameError("template_not_found", "Template not found");
      }
      if (current.archivedAt) {
        const restoresOnly = Object.keys(normalized).every(
          (key) => key === "title" || key === "isActive",
        );
        if (normalized.isActive !== true || !restoresOnly) {
          throw new GameError(
            "invalid_input",
            "Archived template can only be restored or renamed",
          );
        }
        const skill = await getSkillById(tx, userId, current.skillId);
        if (!skill || skill.status !== "active") {
          throw new GameError("skill_archived", "Restore template skill first");
        }
        return restoreTemplate(tx, userId, id, normalized.title);
      }
      if (normalized.skillId !== undefined) {
        const skill = await getSkillById(tx, userId, normalized.skillId);
        if (!skill) {
          throw new GameError("skill_not_found", "Skill not found");
        }
        if (skill.status !== "active") {
          throw new GameError("skill_archived", "Skill is archived");
        }
      }
      const startsOn = normalized.startsOn ?? current.startsOn;
      const endsOn =
        normalized.endsOn === undefined ? current.endsOn : normalized.endsOn;
      if (endsOn && endsOn < startsOn) {
        throw new GameError(
          "invalid_input",
          "Template end date precedes start date",
        );
      }

      const updated = await updateTemplate(tx, userId, id, normalized);
      if (
        updated &&
        (normalized.startsOn !== undefined || normalized.endsOn !== undefined)
      ) {
        await cancelPendingTasksOutsideTemplateRange(
          tx,
          userId,
          id,
          updated.startsOn,
          updated.endsOn,
        );
      }
      return updated;
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
  if (!template) throw new GameError("template_not_found", "Template not found");
  return template;
}

/** Logical archive — keeps history (SPEC §13). */
export async function archiveUserTemplate(
  userId: string,
  id: string,
  db: Database = getDb(),
): Promise<TaskTemplate> {
  const template = await archiveTemplate(db, userId, id);
  if (!template) throw new GameError("template_not_found", "Template not found");
  return template;
}
