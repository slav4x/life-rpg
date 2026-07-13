import {
  awardQuestCompletion,
  type QuestCompletionOutcome,
} from "@/application/quests/award-completion";
import type { DbClient } from "@/db/client";
import {
  getStepForUser,
  listSteps,
  setStepCompleted,
} from "@/db/repositories/quest-steps";
import { lockQuest } from "@/db/repositories/quests";
import { computeQuestProgress } from "@/domain/game/quest";

/** Complete a linked quest step as part of a task completion transaction. */
export async function completeLinkedQuestStep(
  db: DbClient,
  userId: string,
  stepId: string,
): Promise<QuestCompletionOutcome | null> {
  const step = await getStepForUser(db, userId, stepId);
  if (!step || step.completedAt) return null;

  const quest = await lockQuest(db, userId, step.questId);
  if (!quest || quest.status !== "active") return null;

  await setStepCompleted(db, step.id, new Date());
  if (quest.manualCompletion) return null;

  const steps = await listSteps(db, quest.id);
  if (!computeQuestProgress(steps).allRequiredDone) return null;

  return awardQuestCompletion(db, userId, quest);
}
