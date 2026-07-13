import { GameError } from "@/application/game/errors";
import {
  awardQuestCompletion,
  type QuestCompletionOutcome,
} from "@/application/quests/award-completion";
import { getDb, type Database } from "@/db/client";
import { listSteps } from "@/db/repositories/quest-steps";
import { findActiveQuestCompletion } from "@/db/repositories/quest-completions";
import { lockQuest } from "@/db/repositories/quests";
import { computeQuestProgress } from "@/domain/game/quest";

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
      const completion = await findActiveQuestCompletion(
        tx,
        cmd.userId,
        quest.id,
      );
      if (!completion) {
        throw new GameError("nothing_to_revert", "Quest completion is missing");
      }
      return {
        questId: quest.id,
        completionId: completion.id,
        alreadyCompleted: true,
        rewardXp: quest.rewardXp,
        levelUp: null,
        unlockedAchievements: [],
      };
    }
    if (quest.status === "archived") {
      throw new GameError("quest_not_active", "Quest is not active");
    }

    // All required steps must be done before a quest can be completed (SPEC §5.7).
    const steps = await listSteps(tx, quest.id);
    if (!computeQuestProgress(steps).allRequiredDone) {
      throw new GameError(
        "quest_steps_incomplete",
        "Not all required steps are completed",
      );
    }

    const outcome = await awardQuestCompletion(tx, cmd.userId, quest);
    return { questId: quest.id, alreadyCompleted: false, ...outcome };
  });
}
