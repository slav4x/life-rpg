import type { DbClient } from "@/db/client";
import { listActiveCompletionDatesForTemplate } from "@/db/repositories/completions";
import { getStreak, upsertStreak } from "@/db/repositories/streaks";
import { computeStreakFromDates } from "@/domain/game/streak";

export interface StreakResult {
  current: number;
  best: number;
}

/**
 * Recompute a template's streak from its non-reverted completions and persist
 * it. Used by both completion and revert so the two stay consistent (SPEC §5.6,
 * §11).
 */
export async function recomputeStreak(
  db: DbClient,
  userId: string,
  templateId: string,
): Promise<StreakResult> {
  const dates = await listActiveCompletionDatesForTemplate(db, userId, templateId);
  const computed = computeStreakFromDates(dates);
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
