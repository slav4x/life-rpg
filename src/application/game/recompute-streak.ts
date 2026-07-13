import type { DbClient } from "@/db/client";
import { listActiveCompletionDatesForTemplate } from "@/db/repositories/completions";
import { getStreak, upsertStreak } from "@/db/repositories/streaks";
import { getTemplateById } from "@/db/repositories/task-templates";
import { computeStreak } from "@/domain/game/streak";

export interface StreakResult {
  current: number;
  best: number;
}

/**
 * Recompute a template's streak from its non-reverted completions and persist
 * it. Schedule-aware, so weekday templates aren't penalised for gaps between
 * scheduled days (SPEC §5.6). Used by both completion and revert.
 */
export async function recomputeStreak(
  db: DbClient,
  userId: string,
  templateId: string,
): Promise<StreakResult> {
  const template = await getTemplateById(db, userId, templateId);
  const rule = {
    recurrenceType: template?.recurrenceType ?? "daily",
    weekdays: template?.weekdays ?? null,
  };

  const dates = await listActiveCompletionDatesForTemplate(db, userId, templateId);
  const computed = computeStreak(dates, rule);
  const existing = await getStreak(db, userId, templateId);
  const best = Math.max(existing?.bestCount ?? 0, computed.best);

  const row = await upsertStreak(db, {
    userId,
    templateId,
    current: computed.current,
    best,
    last: computed.last,
  });

  return { current: row.currentCount, best: row.bestCount };
}
