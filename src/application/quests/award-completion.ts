import {
  checkAchievements,
  type UnlockedAchievement,
} from "@/application/game/check-achievements";
import type { DbClient } from "@/db/client";
import { markQuestCompleted } from "@/db/repositories/quests";
import { insertXpTransactions, sumGlobalXp } from "@/db/repositories/xp";
import type { Quest } from "@/db/schema";
import { calculateLevel } from "@/domain/game/calculate-level";

export interface QuestCompletionOutcome {
  rewardXp: number;
  levelUp: { from: number; to: number } | null;
  unlockedAchievements: UnlockedAchievement[];
}

/**
 * Mark a quest completed and grant its reward XP to the global journal, then
 * check achievements. Caller must have locked the quest and verified it is not
 * already completed.
 */
export async function awardQuestCompletion(
  db: DbClient,
  userId: string,
  quest: Quest,
): Promise<QuestCompletionOutcome> {
  const totalBefore = await sumGlobalXp(db, userId);

  await markQuestCompleted(db, quest.id);

  if (quest.rewardXp > 0) {
    await insertXpTransactions(db, [
      {
        userId,
        amount: quest.rewardXp,
        scope: "global",
        sourceType: "quest_completion",
        sourceId: quest.id,
        attributeId: quest.attributeId,
        skillId: null,
        baseXp: quest.rewardXp,
        multiplier: "1",
      },
    ]);
  }

  const levelBefore = calculateLevel(totalBefore);
  const levelAfter = calculateLevel(totalBefore + quest.rewardXp);
  const unlockedAchievements = await checkAchievements(db, userId, quest.id);

  return {
    rewardXp: quest.rewardXp,
    levelUp: levelAfter > levelBefore ? { from: levelBefore, to: levelAfter } : null,
    unlockedAchievements,
  };
}
