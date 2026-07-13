export type QuestType = "main" | "side" | "long_term";
export type QuestStatus = "draft" | "active" | "completed" | "archived";

export const QUEST_TYPES: { value: QuestType; label: string }[] = [
  { value: "main", label: "Основной" },
  { value: "side", label: "Побочный" },
  { value: "long_term", label: "Долгосрочный" },
];

export function isQuestType(value: string): value is QuestType {
  return value === "main" || value === "side" || value === "long_term";
}

export interface QuestProgress {
  total: number;
  completed: number;
  requiredTotal: number;
  requiredCompleted: number;
  percent: number;
  /** All required steps done (vacuously true when there are none). */
  allRequiredDone: boolean;
}

export function computeQuestProgress(
  steps: { isRequired: boolean; completedAt: Date | string | null }[],
): QuestProgress {
  const total = steps.length;
  const completed = steps.filter((s) => s.completedAt !== null).length;
  const required = steps.filter((s) => s.isRequired);
  const requiredCompleted = required.filter(
    (s) => s.completedAt !== null,
  ).length;

  return {
    total,
    completed,
    requiredTotal: required.length,
    requiredCompleted,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    allRequiredDone: requiredCompleted === required.length,
  };
}
