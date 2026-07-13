import type { Difficulty, TaskPriority } from "@/domain/game/constants";

export interface TaskVM {
  id: string;
  title: string;
  description: string | null;
  skillId: string;
  skillName: string;
  baseXp: number;
  difficulty: Difficulty;
  priority: TaskPriority;
  status: string;
  finalXp: number;
  estimatedMinutes: number | null;
  focusPosition: number | null;
  templateId: string | null;
  questStepId: string | null;
  /** Current streak for template tasks; null for one-off tasks. */
  streak: number | null;
}

export interface SkillOption {
  id: string;
  name: string;
  attributeId: string;
}
