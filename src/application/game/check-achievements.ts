import { computeAchievementStats } from "@/application/game/user-stats";
import type { DbClient } from "@/db/client";
import {
  insertUserAchievements,
  listAchievements,
  listUserAchievements,
} from "@/db/repositories/achievements";
import { evaluateAchievementRule } from "@/domain/game/achievements";

export interface UnlockedAchievement {
  code: string;
  name: string;
  icon: string | null;
}

/**
 * Unlock any newly-earned achievements and return them (SPEC §5.8). Runs
 * synchronously after a task or quest completion; idempotent — already-unlocked
 * achievements are skipped.
 */
export async function checkAchievements(
  db: DbClient,
  userId: string,
  sourceId?: string,
): Promise<UnlockedAchievement[]> {
  const all = await listAchievements(db);
  if (all.length === 0) return [];

  const unlocked = new Set(
    (await listUserAchievements(db, userId)).map((u) => u.achievementId),
  );
  const pending = all.filter((a) => !unlocked.has(a.id));
  if (pending.length === 0) return [];

  const stats = await computeAchievementStats(db, userId);
  const toUnlock = pending.filter((a) =>
    evaluateAchievementRule(a.ruleType, a.ruleConfig, stats),
  );
  if (toUnlock.length === 0) return [];

  await insertUserAchievements(
    db,
    userId,
    toUnlock.map((a) => a.id),
    sourceId,
  );
  return toUnlock.map((a) => ({ code: a.code, name: a.name, icon: a.icon }));
}
