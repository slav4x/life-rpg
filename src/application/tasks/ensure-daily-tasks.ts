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
  const templates = await listActiveTemplates(db, userId);
  if (templates.length === 0) return;

  const weekday = getIsoWeekday(localDate);
  const applicable = templates.filter((t) =>
    templateAppliesOnWeekday(
      { recurrenceType: t.recurrenceType, weekdays: t.weekdays },
      weekday,
    ),
  );

  await insertTasksFromTemplates(
    db,
    applicable.map((t) => ({
      userId,
      templateId: t.id,
      skillId: t.skillId,
      title: t.title,
      description: t.description,
      localDate,
      baseXp: t.baseXp,
      difficulty: t.difficulty,
      estimatedMinutes: t.estimatedMinutes,
    })),
  );
}
