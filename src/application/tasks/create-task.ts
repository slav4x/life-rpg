import { GameError } from "@/application/game/errors";
import { getDb, type Database } from "@/db/client";
import { getStepForUser } from "@/db/repositories/quest-steps";
import { getQuestById } from "@/db/repositories/quests";
import { getSkillById } from "@/db/repositories/skills";
import {
  createTask,
  getActiveTaskByQuestStepId,
} from "@/db/repositories/tasks";
import type { Task } from "@/db/schema";
import { isDifficulty } from "@/domain/game/constants";

export interface CreateTaskCommand {
  userId: string;
  skillId: string;
  title: string;
  description?: string;
  localDate: string;
  baseXp: number;
  difficulty: string;
  estimatedMinutes?: number;
  questStepId?: string;
}

/** Create a one-off task after validating the skill belongs to the user. */
export async function createOneOffTask(
  cmd: CreateTaskCommand,
  db: Database = getDb(),
): Promise<Task> {
  if (!isDifficulty(cmd.difficulty)) {
    throw new GameError("invalid_input", "Unknown difficulty");
  }

  return db.transaction(async (tx) => {
    const skill = await getSkillById(tx, cmd.userId, cmd.skillId);
    if (!skill || skill.status !== "active") {
      throw new GameError("skill_not_found", "Skill not found");
    }

    if (cmd.questStepId) {
      const step = await getStepForUser(tx, cmd.userId, cmd.questStepId);
      if (!step) throw new GameError("step_not_found", "Step not found");
      const quest = await getQuestById(tx, cmd.userId, step.questId);
      if (!quest || quest.status !== "active") {
        throw new GameError("quest_not_active", "Quest is not active");
      }
      if (step.completedAt) {
        throw new GameError("step_already_completed", "Step is already completed");
      }
      if (await getActiveTaskByQuestStepId(tx, cmd.userId, step.id)) {
        throw new GameError("quest_step_task_exists", "Step already has a task");
      }
    }

    return createTask(tx, {
      userId: cmd.userId,
      skillId: cmd.skillId,
      title: cmd.title,
      description: cmd.description ?? null,
      localDate: cmd.localDate,
      baseXp: cmd.baseXp,
      difficulty: cmd.difficulty,
      estimatedMinutes: cmd.estimatedMinutes ?? null,
      questStepId: cmd.questStepId ?? null,
    });
  });
}
