import { GameError } from "@/application/game/errors";
import { getDb } from "@/db/client";
import { listSteps, stepCountsByQuest } from "@/db/repositories/quest-steps";
import {
  getQuestById,
  listQuests,
  updateQuest,
  type UpdateQuestFields,
} from "@/db/repositories/quests";
import type { Quest, QuestStep } from "@/db/schema";

export async function listUserQuests(userId: string): Promise<Quest[]> {
  return listQuests(getDb(), userId);
}

export interface QuestListItem {
  quest: Quest;
  total: number;
  completed: number;
}

export async function listUserQuestsWithProgress(
  userId: string,
): Promise<QuestListItem[]> {
  const db = getDb();
  const [quests, counts] = await Promise.all([
    listQuests(db, userId),
    stepCountsByQuest(db, userId),
  ]);
  const byId = new Map(counts.map((c) => [c.questId, c]));
  return quests.map((quest) => ({
    quest,
    total: byId.get(quest.id)?.total ?? 0,
    completed: byId.get(quest.id)?.completed ?? 0,
  }));
}

export interface QuestWithSteps {
  quest: Quest;
  steps: QuestStep[];
}

export async function getUserQuest(
  userId: string,
  id: string,
): Promise<QuestWithSteps> {
  const db = getDb();
  const quest = await getQuestById(db, userId, id);
  if (!quest) throw new GameError("quest_not_found", "Quest not found");
  const steps = await listSteps(db, quest.id);
  return { quest, steps };
}

export async function updateUserQuest(
  userId: string,
  id: string,
  fields: UpdateQuestFields,
): Promise<Quest> {
  const quest = await updateQuest(getDb(), userId, id, fields);
  if (!quest) throw new GameError("quest_not_found", "Quest not found");
  return quest;
}
