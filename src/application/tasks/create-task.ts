import { GameError } from "@/application/game/errors";
import { getDb } from "@/db/client";
import { getSkillById } from "@/db/repositories/skills";
import { createTask } from "@/db/repositories/tasks";
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
}

/** Create a one-off task after validating the skill belongs to the user. */
export async function createOneOffTask(cmd: CreateTaskCommand): Promise<Task> {
  if (!isDifficulty(cmd.difficulty)) {
    throw new GameError("invalid_input", "Unknown difficulty");
  }

  const db = getDb();
  const skill = await getSkillById(db, cmd.userId, cmd.skillId);
  if (!skill || skill.status !== "active") {
    throw new GameError("skill_not_found", "Skill not found");
  }

  return createTask(db, {
    userId: cmd.userId,
    skillId: cmd.skillId,
    title: cmd.title,
    description: cmd.description ?? null,
    localDate: cmd.localDate,
    baseXp: cmd.baseXp,
    difficulty: cmd.difficulty,
    estimatedMinutes: cmd.estimatedMinutes ?? null,
  });
}
