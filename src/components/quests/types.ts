export interface QuestVM {
  id: string;
  title: string;
  type: string;
  status: string;
  rewardXp: number;
  total: number;
  completed: number;
  percent: number;
}

export interface StepVM {
  id: string;
  title: string;
  description: string | null;
  isRequired: boolean;
  completed: boolean;
}

export interface QuestDetailVM {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  rewardXp: number;
}
