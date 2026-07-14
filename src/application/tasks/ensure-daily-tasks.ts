import { getDb, type DbClient } from "@/db/client";
import { listActiveTemplates } from "@/db/repositories/task-templates";
import { insertTasksFromTemplates } from "@/db/repositories/tasks";
import { templateAppliesOnWeekday } from "@/domain/game/recurrence";
import { getIsoWeekday } from "@/lib/dates/local-date";

/**
 * Lazily materialise a day's tasks from the user's active templates (SPEC §12).
 * Idempotent and concurrency-safe via the tasks partial unique index, so it can
 * be called on every «Сегодня» load without producing duplicates.
 */
export async function ensureTasksForDate(
  userId: string,
  localDate: string,
  db: DbClient = getDb(),
): Promise<void> {
  return ensureTasksForDates(userId, [localDate], db);
}

/** Materialise several local dates with one template read and one bulk insert. */
export async function ensureTasksForDates(
  userId: string,
  localDates: string[],
  db: DbClient = getDb(),
): Promise<void> {
  const dates = [...new Set(localDates)];
  if (dates.length === 0) return;

  const templates = await listActiveTemplates(db, userId);
  if (templates.length === 0) return;

  await insertTasksFromTemplates(
    db,
    dates.flatMap((localDate) => {
      const weekday = getIsoWeekday(localDate);
      return templates
        .filter(
          (template) =>
            template.startsOn <= localDate &&
            (!template.endsOn || template.endsOn >= localDate) &&
            templateAppliesOnWeekday(
              {
                recurrenceType: template.recurrenceType,
                weekdays: template.weekdays,
              },
              weekday,
            ),
        )
        .map((template) => ({
          userId,
          templateId: template.id,
          skillId: template.skillId,
          title: template.title,
          description: template.description,
          localDate,
          baseXp: template.baseXp,
          difficulty: template.difficulty,
          priority: template.priority,
          estimatedMinutes: template.estimatedMinutes,
        }));
    }),
  );
}
