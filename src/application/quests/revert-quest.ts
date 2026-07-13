import { GameError } from "@/application/game/errors";
import { getDb, type Database } from "@/db/client";
import {
  findActiveQuestCompletion,
  findLatestQuestCompletion,
  markQuestCompletionReverted,
} from "@/db/repositories/quest-completions";
import { lockQuest, markQuestActive } from "@/db/repositories/quests";
import {
  getTransactionsBySourceAndType,
  insertXpTransactions,
} from "@/db/repositories/xp";

export interface RevertQuestResult {
  questId: string;
  reverted: boolean;
  alreadyReverted: boolean;
}

/** Revert quest completion while preserving XP and achievement history. */
export async function revertQuest(
  cmd: { userId: string; questId: string },
  db: Database = getDb(),
): Promise<RevertQuestResult> {
  return db.transaction(async (tx) => {
    const quest = await lockQuest(tx, cmd.userId, cmd.questId);
    if (!quest) throw new GameError("quest_not_found", "Quest not found");

    const completion = await findActiveQuestCompletion(
      tx,
      cmd.userId,
      quest.id,
    );
    if (!completion) {
      const latest = await findLatestQuestCompletion(tx, cmd.userId, quest.id);
      if (latest?.revertedAt && quest.status === "active") {
        return { questId: quest.id, reverted: false, alreadyReverted: true };
      }
      throw new GameError("nothing_to_revert", "Quest has no active completion");
    }

    await markQuestCompletionReverted(tx, completion.id);
    await markQuestActive(tx, quest.id);

    const originals = await getTransactionsBySourceAndType(
      tx,
      cmd.userId,
      completion.id,
      "quest_completion",
    );
    await insertXpTransactions(
      tx,
      originals.map((original) => ({
        userId: cmd.userId,
        amount: -original.amount,
        scope: original.scope,
        sourceType: "reversal",
        sourceId: original.id,
        attributeId: original.attributeId,
        skillId: original.skillId,
        baseXp: original.baseXp,
        multiplier: original.multiplier,
        reversalOfId: original.id,
      })),
    );

    return { questId: quest.id, reverted: true, alreadyReverted: false };
  });
}
