import {
  ATTRIBUTE_XP_COEFFICIENT,
  DIFFICULTY_MULTIPLIERS,
  type Difficulty,
} from "./constants";

/** Final XP for a completed task (SPEC §5.5). Streaks do not affect XP in MVP. */
export function calculateFinalXp(baseXp: number, difficulty: Difficulty): number {
  return Math.round(baseXp * DIFFICULTY_MULTIPLIERS[difficulty]);
}

/** Portion of the final XP credited to the linked attribute (SPEC §5.2). */
export function calculateAttributeXp(finalXp: number): number {
  return Math.round(finalXp * ATTRIBUTE_XP_COEFFICIENT);
}

export interface XpBreakdown {
  global: number;
  skill: number;
  attribute: number;
  multiplier: number;
}

/**
 * Full XP breakdown for a completion: 100% to global, 100% to the skill,
 * 25% to the attribute.
 */
export function calculateXpBreakdown(
  baseXp: number,
  difficulty: Difficulty,
): XpBreakdown {
  const finalXp = calculateFinalXp(baseXp, difficulty);
  return {
    global: finalXp,
    skill: finalXp,
    attribute: calculateAttributeXp(finalXp),
    multiplier: DIFFICULTY_MULTIPLIERS[difficulty],
  };
}
