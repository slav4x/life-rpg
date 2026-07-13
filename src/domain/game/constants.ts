/** Static game configuration (SPEC §5). Kept in the domain, not the UI/API. */

export type AttributeCode =
  | "body"
  | "mind"
  | "resources"
  | "social"
  | "discipline"
  | "creation";

export interface AttributeDef {
  code: AttributeCode;
  name: string;
  description: string;
  sortOrder: number;
}

/** The six fixed system attributes (SPEC §5.2). */
export const ATTRIBUTES: AttributeDef[] = [
  { code: "body", name: "Тело", description: "Здоровье, сила, выносливость, восстановление", sortOrder: 1 },
  { code: "mind", name: "Разум", description: "Обучение, мышление, профессиональные знания", sortOrder: 2 },
  { code: "resources", name: "Ресурсы", description: "Доход, накопления, продажи, управление деньгами", sortOrder: 3 },
  { code: "social", name: "Социум", description: "Отношения, общение, переговоры, лидерство", sortOrder: 4 },
  { code: "discipline", name: "Дисциплина", description: "Последовательность, фокус, выполнение обещаний себе", sortOrder: 5 },
  { code: "creation", name: "Созидание", description: "Код, дизайн, тексты, фото, видео и проекты", sortOrder: 6 },
];

/** Share of a task's final XP that also flows into its attribute (SPEC §5.2). */
export const ATTRIBUTE_XP_COEFFICIENT = 0.25;

export type Difficulty = "easy" | "normal" | "hard" | "epic";

export const DIFFICULTY_MULTIPLIERS: Record<Difficulty, number> = {
  easy: 0.8,
  normal: 1.0,
  hard: 1.3,
  epic: 1.5,
};

export const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Лёгкая" },
  { value: "normal", label: "Обычная" },
  { value: "hard", label: "Сложная" },
  { value: "epic", label: "Эпическая" },
];

export function isDifficulty(value: string): value is Difficulty {
  return value in DIFFICULTY_MULTIPLIERS;
}

/** Recommended base-XP range shown as a hint in the add-action form (SPEC §5.4). */
export const BASE_XP = { min: 5, max: 250, default: 25 } as const;

export interface StarterSkill {
  name: string;
  attribute: AttributeCode;
}

/** A small starter set seeded for new users so the first action can be created. */
export const STARTER_SKILLS: StarterSkill[] = [
  { name: "Силовые тренировки", attribute: "body" },
  { name: "Кардио", attribute: "body" },
  { name: "Frontend", attribute: "mind" },
  { name: "Английский", attribute: "mind" },
  { name: "Финансы", attribute: "resources" },
  { name: "Общение", attribute: "social" },
  { name: "Фокус", attribute: "discipline" },
  { name: "Код", attribute: "creation" },
];

/** Small curated visual set for user skills (SPEC §5.3). */
export const SKILL_ICONS = ["✨", "💪", "🧠", "💼", "🤝", "🎨", "⚡", "📚"] as const;

export const SKILL_COLORS = [
  "#6366F1",
  "#0EA5E9",
  "#14B8A6",
  "#22C55E",
  "#F59E0B",
  "#F97316",
  "#EC4899",
  "#8B5CF6",
] as const;
