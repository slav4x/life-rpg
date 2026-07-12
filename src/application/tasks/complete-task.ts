import { eq } from "drizzle-orm";

import { GameError } from "@/application/game/errors";
import { getDb, type Database, type Transaction } from "@/db/client";
import {
  createCompletion,
  findActiveCompletionByTask,
} from "@/db/repositories/completions";
import { getSkillById } from "@/db/repositories/skills";
import { lockTask, setTaskStatus } from "@/db/repositories/tasks";
import {
  getUserAttributeXp,
  getUserSkillXp,
  incrementUserAttributeXp,
  incrementUserSkillXp,
  insertXpTransactions,
  sumGlobalXp,
} from "@/db/repositories/xp";
import { attributes, type Attribute, type Skill } from "@/db/schema";
import { calculateLevel } from "@/domain/game/calculate-level";
import { calculateAttributeXp, calculateXpBreakdown } from "@/domain/game/calculate-xp";
import { DIFFICULTY_MULTIPLIERS, isDifficulty } from "@/domain/game/constants";

export interface CompleteTaskResult {
  completionId: string;
  alreadyCompleted: boolean;
  xp: { global: number; skill: number; attribute: number };
  levelUp: { from: number; to: number } | null;
  skill: { id: string; name: string; xp: number; level: number; leveledUp: boolean };
  attribute: { id: string; code: string; name: string; xp: number };
}

export interface CompleteTaskCommand {
  userId: string;
  taskId: string;
  idempotencyKey: string;
}

/**
 * Complete a task in a single transaction (SPEC §11): lock the row, verify
 * ownership and idempotency, compute XP server-side, write the completion and
 * three XP-journal entries (global / skill / attribute), and refresh the
 * cached skill and attribute totals. Streaks and achievements arrive later.
 */
export async function completeTask(
  cmd: CompleteTaskCommand,
  db: Database = getDb(),
): Promise<CompleteTaskResult> {
  return db.transaction(async (tx) => {
    const task = await lockTask(tx, cmd.userId, cmd.taskId);
    if (!task) throw new GameError("task_not_found", "Task not found");

    const skill = await getSkillById(tx, cmd.userId, task.skillId);
    if (!skill) throw new GameError("skill_not_found", "Skill not found");

    const [attribute] = await tx
      .select()
      .from(attributes)
      .where(eq(attributes.id, skill.attributeId))
      .limit(1);
    if (!attribute) throw new GameError("attribute_not_found", "Attribute not found");

    // Idempotency: a repeat completion returns the prior result, no re-accrual.
    const existing = await findActiveCompletionByTask(tx, cmd.userId, cmd.taskId);
    if (existing) {
      return buildIdempotentResult(tx, existing.id, existing.finalXp, skill, attribute, cmd.userId);
    }

    if (task.status !== "pending") {
      throw new GameError("task_not_pending", "Task is not pending");
    }
    if (!isDifficulty(task.difficulty)) {
      throw new GameError("invalid_input", "Unknown difficulty");
    }

    const breakdown = calculateXpBreakdown(task.baseXp, task.difficulty);
    const multiplier = DIFFICULTY_MULTIPLIERS[task.difficulty].toFixed(2);
    const totalBefore = await sumGlobalXp(tx, cmd.userId);

    const completion = await createCompletion(tx, {
      userId: cmd.userId,
      taskId: task.id,
      idempotencyKey: cmd.idempotencyKey,
      localDate: task.localDate,
      finalXp: breakdown.global,
    });
    await setTaskStatus(tx, task.id, "completed");

    await insertXpTransactions(tx, [
      {
        userId: cmd.userId,
        amount: breakdown.global,
        scope: "global",
        sourceType: "task_completion",
        sourceId: completion.id,
        baseXp: task.baseXp,
        multiplier,
      },
      {
        userId: cmd.userId,
        amount: breakdown.skill,
        scope: "skill",
        sourceType: "task_completion",
        sourceId: completion.id,
        skillId: skill.id,
        baseXp: task.baseXp,
        multiplier,
      },
      {
        userId: cmd.userId,
        amount: breakdown.attribute,
        scope: "attribute",
        sourceType: "task_completion",
        sourceId: completion.id,
        attributeId: attribute.id,
        baseXp: task.baseXp,
        multiplier,
      },
    ]);

    const skillXp = await incrementUserSkillXp(tx, cmd.userId, skill.id, breakdown.skill);
    const attributeXp = await incrementUserAttributeXp(
      tx,
      cmd.userId,
      attribute.id,
      breakdown.attribute,
    );

    const levelBefore = calculateLevel(totalBefore);
    const levelAfter = calculateLevel(totalBefore + breakdown.global);
    const skillLevelBefore = calculateLevel(skillXp - breakdown.skill);
    const skillLevelAfter = calculateLevel(skillXp);

    return {
      completionId: completion.id,
      alreadyCompleted: false,
      xp: breakdown,
      levelUp: levelAfter > levelBefore ? { from: levelBefore, to: levelAfter } : null,
      skill: {
        id: skill.id,
        name: skill.name,
        xp: skillXp,
        level: skillLevelAfter,
        leveledUp: skillLevelAfter > skillLevelBefore,
      },
      attribute: {
        id: attribute.id,
        code: attribute.code,
        name: attribute.name,
        xp: attributeXp,
      },
    } satisfies CompleteTaskResult;
  });
}

async function buildIdempotentResult(
  tx: Transaction,
  completionId: string,
  finalXp: number,
  skill: Skill,
  attribute: Attribute,
  userId: string,
): Promise<CompleteTaskResult> {
  const skillXp = await getUserSkillXp(tx, userId, skill.id);
  const attributeXp = await getUserAttributeXp(tx, userId, attribute.id);

  return {
    completionId,
    alreadyCompleted: true,
    xp: {
      global: finalXp,
      skill: finalXp,
      attribute: calculateAttributeXp(finalXp),
    },
    levelUp: null,
    skill: {
      id: skill.id,
      name: skill.name,
      xp: skillXp,
      level: calculateLevel(skillXp),
      leveledUp: false,
    },
    attribute: {
      id: attribute.id,
      code: attribute.code,
      name: attribute.name,
      xp: attributeXp,
    },
  };
}
