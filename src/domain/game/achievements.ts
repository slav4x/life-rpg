/** Objective stats an achievement rule is evaluated against (SPEC §5.8). */
export interface AchievementStats {
  tasksCompleted: number;
  totalXp: number;
  globalLevel: number;
  maxStreak: number;
  questsCompleted: number;
  maxSkillLevel: number;
  attributesStarted: number;
}

export type AchievementRuleType =
  | "tasks_completed"
  | "total_xp"
  | "global_level"
  | "streak"
  | "quests_completed"
  | "skill_level"
  | "attributes_started";

/** True when the user's stats satisfy the achievement's threshold rule. */
export function evaluateAchievementRule(
  ruleType: string,
  config: { threshold: number },
  stats: AchievementStats,
): boolean {
  const t = config.threshold;
  switch (ruleType) {
    case "tasks_completed":
      return stats.tasksCompleted >= t;
    case "total_xp":
      return stats.totalXp >= t;
    case "global_level":
      return stats.globalLevel >= t;
    case "streak":
      return stats.maxStreak >= t;
    case "quests_completed":
      return stats.questsCompleted >= t;
    case "skill_level":
      return stats.maxSkillLevel >= t;
    case "attributes_started":
      return stats.attributesStarted >= t;
    default:
      return false;
  }
}
