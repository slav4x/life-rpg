export interface QuestVM {
  id: string;
  title: string;
  type: string;
  status: string;
  rewardXp: number;
  total: number;
  completed: number;
  requiredTotal: number;
  requiredCompleted: number;
  percent: number;
  attributeName: string | null;
  dueDate: string | null;
  completedAt: string | null;
}

export interface StepVM {
  id: string;
  title: string;
  description: string | null;
  isRequired: boolean;
  completed: boolean;
  task: {
    id: string;
    status: string;
    localDate: string;
  } | null;
}

export interface QuestDetailVM {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  rewardXp: number;
  attributeId: string | null;
  attributeName: string | null;
  dueDate: string | null;
  manualCompletion: boolean;
  completedAt: string | null;
}

export interface QuestAttributeOption {
  id: string;
  name: string;
}
