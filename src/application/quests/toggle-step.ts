import { GameError } from "@/application/game/errors";
import {
  awardQuestCompletion,
  type QuestCompletionOutcome,
} from "@/application/quests/award-completion";
import { getDb, type Database } from "@/db/client";
import {
  getStepForUser,
  listSteps,
  setStepCompleted,
} from "@/db/repositories/quest-steps";
import { lockQuest } from "@/db/repositories/quests";
import { computeQuestProgress } from "@/domain/game/quest";

export interface ToggleStepResult {
  stepId: string;
  completed: boolean;
  /** Present when toggling auto-completed the quest (manual_completion off). */
  questCompleted: QuestCompletionOutcome | null;
}

export async function toggleStep(
  cmd: { userId: string; stepId: string },
  db: Database = getDb(),
): Promise<ToggleStepResult> {
  return db.transaction(async (tx) => {
    const step = await getStepForUser(tx, cmd.userId, cmd.stepId);
    if (!step) throw new GameError("step_not_found", "Step not found");

    // Steps of a completed/archived quest are frozen.
    const quest = await lockQuest(tx, cmd.userId, step.questId);
    if (!quest || quest.status !== "active") {
      throw new GameError("quest_not_active", "Quest is not active");
    }

    const nowCompleted = step.completedAt === null;
    await setStepCompleted(tx, step.id, nowCompleted ? new Date() : null);

    let questCompleted: QuestCompletionOutcome | null = null;
    if (nowCompleted && !quest.manualCompletion) {
      const steps = await listSteps(tx, quest.id);
      if (computeQuestProgress(steps).allRequiredDone) {
        questCompleted = await awardQuestCompletion(tx, cmd.userId, quest);
      }
    }

    return { stepId: step.id, completed: nowCompleted, questCompleted };
  });
}
