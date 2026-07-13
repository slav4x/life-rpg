import { GameError } from "@/application/game/errors";
import { getDb } from "@/db/client";
import {
  archiveTemplate,
  listTemplates,
  updateTemplate,
  type UpdateTemplateFields,
} from "@/db/repositories/task-templates";
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
): Promise<TaskTemplate> {
  // Switching to a daily recurrence clears any leftover weekday list.
  const normalized: UpdateTemplateFields =
    fields.recurrenceType === "daily" ? { ...fields, weekdays: null } : fields;

  const template = await updateTemplate(getDb(), userId, id, normalized);
  if (!template) throw new GameError("template_not_found", "Template not found");
  return template;
}

/** Logical archive — keeps history (SPEC §13). */
export async function archiveUserTemplate(
  userId: string,
  id: string,
): Promise<TaskTemplate> {
  const template = await archiveTemplate(getDb(), userId, id);
  if (!template) throw new GameError("template_not_found", "Template not found");
  return template;
}
