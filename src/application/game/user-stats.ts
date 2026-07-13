import type { DbClient } from "@/db/client";
import { countCompletedQuests } from "@/db/repositories/quests";
import {
  countCompletedTasks,
  countStartedAttributes,
  maxCurrentStreak,
  maxSkillXp,
} from "@/db/repositories/stats";
import { sumGlobalXp } from "@/db/repositories/xp";
import type { AchievementStats } from "@/domain/game/achievements";
import { calculateLevel } from "@/domain/game/calculate-level";

/**
 * Objective stats for achievement evaluation. Queries run sequentially because
 * this is often called inside a transaction (single connection).
 */
export async function computeAchievementStats(
  db: DbClient,
  userId: string,
): Promise<AchievementStats> {
  const totalXp = await sumGlobalXp(db, userId);
  const tasksCompleted = await countCompletedTasks(db, userId);
  const maxStreak = await maxCurrentStreak(db, userId);
  const questsCompleted = await countCompletedQuests(db, userId);
  const topSkillXp = await maxSkillXp(db, userId);
  const attributesStarted = await countStartedAttributes(db, userId);

  return {
    totalXp,
    globalLevel: calculateLevel(totalXp),
    tasksCompleted,
    maxStreak,
    questsCompleted,
    maxSkillLevel: calculateLevel(topSkillXp),
    attributesStarted,
  };
}
