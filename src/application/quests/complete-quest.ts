import { GameError } from "@/application/game/errors";
import {
  awardQuestCompletion,
  type QuestCompletionOutcome,
} from "@/application/quests/award-completion";
import { getDb, type Database } from "@/db/client";
import { lockQuest } from "@/db/repositories/quests";

export interface CompleteQuestResult extends QuestCompletionOutcome {
  questId: string;
  alreadyCompleted: boolean;
}

/** Complete a quest and grant its reward in one transaction (SPEC §5.7, §11). */
export async function completeQuest(
  cmd: { userId: string; questId: string },
  db: Database = getDb(),
): Promise<CompleteQuestResult> {
  return db.transaction(async (tx) => {
    const quest = await lockQuest(tx, cmd.userId, cmd.questId);
    if (!quest) throw new GameError("quest_not_found", "Quest not found");

    if (quest.status === "completed") {
      return {
        questId: quest.id,
        alreadyCompleted: true,
        rewardXp: quest.rewardXp,
        levelUp: null,
        unlockedAchievements: [],
      };
    }
    if (quest.status === "archived") {
      throw new GameError("quest_not_active", "Quest is not active");
    }

    const outcome = await awardQuestCompletion(tx, cmd.userId, quest);
    return { questId: quest.id, alreadyCompleted: false, ...outcome };
  });
}
