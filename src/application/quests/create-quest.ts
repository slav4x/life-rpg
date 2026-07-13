import { GameError } from "@/application/game/errors";
import { getDb } from "@/db/client";
import { createSteps } from "@/db/repositories/quest-steps";
import { createQuest } from "@/db/repositories/quests";
import type { Quest } from "@/db/schema";
import { isQuestType } from "@/domain/game/quest";

export interface CreateQuestCommand {
  userId: string;
  title: string;
  description?: string;
  type: string;
  attributeId?: string | null;
  rewardXp: number;
  dueDate?: string | null;
  manualCompletion?: boolean;
  steps: { title: string; isRequired?: boolean }[];
}

export async function createUserQuest(cmd: CreateQuestCommand): Promise<Quest> {
  if (!isQuestType(cmd.type)) {
    throw new GameError("invalid_input", "Unknown quest type");
  }

  return getDb().transaction(async (tx) => {
    const quest = await createQuest(tx, {
      userId: cmd.userId,
      title: cmd.title,
      description: cmd.description ?? null,
      type: cmd.type,
      attributeId: cmd.attributeId ?? null,
      rewardXp: cmd.rewardXp,
      dueDate: cmd.dueDate ?? null,
      manualCompletion: cmd.manualCompletion ?? true,
      status: "active",
    });

    await createSteps(
      tx,
      quest.id,
      cmd.steps.map((s, index) => ({
        title: s.title,
        isRequired: s.isRequired ?? true,
        sortOrder: index,
      })),
    );

    return quest;
  });
}
