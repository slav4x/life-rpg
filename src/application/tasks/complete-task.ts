import { eq } from "drizzle-orm";

import {
  checkAchievements,
  type UnlockedAchievement,
} from "@/application/game/check-achievements";
import { GameError } from "@/application/game/errors";
import { recomputeStreak } from "@/application/game/recompute-streak";
import { completeLinkedQuestStep } from "@/application/quests/complete-linked-step";
import type { QuestCompletionOutcome } from "@/application/quests/award-completion";
import { getDb, type Database, type Transaction } from "@/db/client";
import {
  createCompletion,
  findActiveCompletionByTask,
} from "@/db/repositories/completions";
import { getSkillById } from "@/db/repositories/skills";
import { getStreak } from "@/db/repositories/streaks";
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
  streak: { current: number; best: number } | null;
  unlockedAchievements: UnlockedAchievement[];
  questCompleted: QuestCompletionOutcome | null;
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
 * cached skill and attribute totals, streaks and achievements.
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
      return buildIdempotentResult(tx, {
        completionId: existing.id,
        finalXp: existing.finalXp,
        skill,
        attribute,
        userId: cmd.userId,
        templateId: task.templateId,
      });
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

    const streak = task.templateId
      ? await recomputeStreak(tx, cmd.userId, task.templateId)
      : null;

    const unlockedAchievements = await checkAchievements(
      tx,
      cmd.userId,
      completion.id,
    );
    const questCompleted = task.questStepId
      ? await completeLinkedQuestStep(tx, cmd.userId, task.questStepId)
      : null;

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
      streak,
      unlockedAchievements,
      questCompleted,
    } satisfies CompleteTaskResult;
  });
}

async function buildIdempotentResult(
  tx: Transaction,
  input: {
    completionId: string;
    finalXp: number;
    skill: Skill;
    attribute: Attribute;
    userId: string;
    templateId: string | null;
  },
): Promise<CompleteTaskResult> {
  const { completionId, finalXp, skill, attribute, userId, templateId } = input;
  const skillXp = await getUserSkillXp(tx, userId, skill.id);
  const attributeXp = await getUserAttributeXp(tx, userId, attribute.id);
  const streakRow = templateId
    ? await getStreak(tx, userId, templateId)
    : undefined;

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
    streak: streakRow
      ? { current: streakRow.currentCount, best: streakRow.bestCount }
      : null,
    unlockedAchievements: [],
    questCompleted: null,
  };
}
