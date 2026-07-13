import type { Difficulty } from "@/domain/game/constants";

export interface TaskVM {
  id: string;
  title: string;
  description: string | null;
  skillName: string;
  baseXp: number;
  difficulty: Difficulty;
  status: string;
  finalXp: number;
  templateId: string | null;
  /** Current streak for template tasks; null for one-off tasks. */
  streak: number | null;
}

export interface SkillOption {
  id: string;
  name: string;
}
