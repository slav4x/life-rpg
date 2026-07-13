import { GameError } from "@/application/game/errors";
import {
  awardQuestCompletion,
  type QuestCompletionOutcome,
} from "@/application/quests/award-completion";
import { getDb, type Database } from "@/db/client";
import { listAttributes } from "@/db/repositories/attributes";
import {
  listSteps,
  stepCountsByQuest,
  syncSteps,
  type SyncStepInput,
} from "@/db/repositories/quest-steps";
import {
  getQuestById,
  listQuests,
  updateQuest,
  type UpdateQuestFields,
} from "@/db/repositories/quests";
import {
  listTaskLinksForQuest,
  type QuestStepTaskLink,
} from "@/db/repositories/tasks";
import type { Attribute, Quest, QuestStep } from "@/db/schema";
import { computeQuestProgress } from "@/domain/game/quest";

export async function listUserQuests(userId: string): Promise<Quest[]> {
  return listQuests(getDb(), userId);
}

export interface QuestListItem {
  quest: Quest;
  total: number;
  completed: number;
  requiredTotal: number;
  requiredCompleted: number;
  attribute: Attribute | null;
}

export async function listUserQuestsWithProgress(
  userId: string,
): Promise<QuestListItem[]> {
  const db = getDb();
  const [quests, counts, attributes] = await Promise.all([
    listQuests(db, userId),
    stepCountsByQuest(db, userId),
    listAttributes(db),
  ]);
  const byId = new Map(counts.map((c) => [c.questId, c]));
  const attributesById = new Map(attributes.map((attribute) => [attribute.id, attribute]));
  return quests.map((quest) => ({
    quest,
    total: byId.get(quest.id)?.total ?? 0,
    completed: byId.get(quest.id)?.completed ?? 0,
    requiredTotal: byId.get(quest.id)?.requiredTotal ?? 0,
    requiredCompleted: byId.get(quest.id)?.requiredCompleted ?? 0,
    attribute: quest.attributeId
      ? (attributesById.get(quest.attributeId) ?? null)
      : null,
  }));
}

export async function listQuestAttributes(): Promise<Attribute[]> {
  return listAttributes(getDb());
}

export interface QuestWithSteps {
  quest: Quest;
  steps: QuestStep[];
  taskLinks: QuestStepTaskLink[];
}

export interface UpdateQuestResult {
  quest: Quest;
  questCompleted: QuestCompletionOutcome | null;
}

export async function getUserQuest(
  userId: string,
  id: string,
): Promise<QuestWithSteps> {
  const db = getDb();
  const quest = await getQuestById(db, userId, id);
  if (!quest) throw new GameError("quest_not_found", "Quest not found");
  const [steps, taskLinks] = await Promise.all([
    listSteps(db, quest.id),
    listTaskLinksForQuest(db, userId, quest.id),
  ]);
  return { quest, steps, taskLinks };
}

export async function updateUserQuest(
  userId: string,
  id: string,
  input: UpdateQuestFields & { steps?: SyncStepInput[] },
  db: Database = getDb(),
): Promise<UpdateQuestResult> {
  return db.transaction(async (tx) => {
    const current = await getQuestById(tx, userId, id);
    if (!current) throw new GameError("quest_not_found", "Quest not found");

    const { steps, ...fields } = input;
    if (current.status === "completed") {
      throw new GameError("quest_not_active", "Completed quest cannot be changed");
    }
    if (
      current.status === "archived" &&
      (fields.status !== "active" ||
        steps !== undefined ||
        Object.entries(fields).some(
          ([key, value]) => key !== "status" && value !== undefined,
        ))
    ) {
      throw new GameError("quest_not_active", "Restore quest before editing");
    }
    if (steps && current.status !== "active" && current.status !== "draft") {
      throw new GameError("quest_not_active", "Quest steps cannot be changed");
    }
    if (
      fields.attributeId &&
      !(await listAttributes(tx)).some(
        (attribute) => attribute.id === fields.attributeId,
      )
    ) {
      throw new GameError("attribute_not_found", "Attribute not found");
    }

    let quest = current;
    if (Object.values(fields).some((value) => value !== undefined)) {
      quest = (await updateQuest(tx, userId, id, fields)) ?? current;
    }
    if (steps) {
      try {
        await syncSteps(tx, id, steps);
      } catch (error) {
        if ((error as Error).message === "quest_step_mismatch") {
          throw new GameError("step_not_found", "Step not found");
        }
        throw error;
      }
    }

    let questCompleted: QuestCompletionOutcome | null = null;
    if (quest.status === "active" && !quest.manualCompletion) {
      const currentSteps = await listSteps(tx, quest.id);
      if (computeQuestProgress(currentSteps).allRequiredDone) {
        questCompleted = await awardQuestCompletion(tx, userId, quest);
        quest = (await getQuestById(tx, userId, id)) ?? quest;
      }
    }

    return { quest, questCompleted };
  });
}
