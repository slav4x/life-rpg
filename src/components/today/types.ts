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
}

export interface SkillOption {
  id: string;
  name: string;
}
