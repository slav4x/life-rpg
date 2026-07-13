import { recomputeStreak } from "@/application/game/recompute-streak";
import { GameError } from "@/application/game/errors";
import { getDb, type Database } from "@/db/client";
import {
  findActiveCompletionByTask,
  markCompletionReverted,
} from "@/db/repositories/completions";
import { lockTask, setTaskStatus } from "@/db/repositories/tasks";
import {
  getTransactionsBySource,
  incrementUserAttributeXp,
  incrementUserSkillXp,
  insertXpTransactions,
} from "@/db/repositories/xp";

export interface RevertResult {
  taskId: string;
  reverted: boolean;
  streak: { current: number; best: number } | null;
}

/**
 * Undo a completion without deleting history (SPEC §11): mark the completion
 * reverted, return the task to pending, write compensating (negative) journal
 * entries linked via `reversal_of_id`, roll back the cached totals, and
 * recompute the template streak from the remaining completions.
 */
export async function revertTask(
  cmd: { userId: string; taskId: string },
  db: Database = getDb(),
): Promise<RevertResult> {
  return db.transaction(async (tx) => {
    const task = await lockTask(tx, cmd.userId, cmd.taskId);
    if (!task) throw new GameError("task_not_found", "Task not found");

    const completion = await findActiveCompletionByTask(tx, cmd.userId, cmd.taskId);
    if (!completion) {
      throw new GameError("nothing_to_revert", "Task has no active completion");
    }

    await markCompletionReverted(tx, completion.id);
    await setTaskStatus(tx, task.id, "pending");

    const originals = await getTransactionsBySource(tx, cmd.userId, completion.id);

    await insertXpTransactions(
      tx,
      originals.map((o) => ({
        userId: cmd.userId,
        amount: -o.amount,
        scope: o.scope,
        sourceType: "reversal",
        sourceId: o.id,
        attributeId: o.attributeId,
        skillId: o.skillId,
        baseXp: o.baseXp,
        multiplier: o.multiplier,
        reversalOfId: o.id,
      })),
    );

    for (const o of originals) {
      if (o.scope === "skill" && o.skillId) {
        await incrementUserSkillXp(tx, cmd.userId, o.skillId, -o.amount);
      } else if (o.scope === "attribute" && o.attributeId) {
        await incrementUserAttributeXp(tx, cmd.userId, o.attributeId, -o.amount);
      }
    }

    const streak = task.templateId
      ? await recomputeStreak(tx, cmd.userId, task.templateId)
      : null;

    return { taskId: task.id, reverted: true, streak };
  });
}
