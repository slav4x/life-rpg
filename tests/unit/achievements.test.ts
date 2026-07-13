import { describe, expect, it } from "vitest";

import {
  evaluateAchievementRule,
  type AchievementStats,
} from "@/domain/game/achievements";

const base: AchievementStats = {
  tasksCompleted: 0,
  totalXp: 0,
  globalLevel: 1,
  maxStreak: 0,
  questsCompleted: 0,
  maxSkillLevel: 1,
  attributesStarted: 0,
};

describe("evaluateAchievementRule", () => {
  it("evaluates each threshold rule against stats", () => {
    expect(
      evaluateAchievementRule("tasks_completed", { threshold: 1 }, { ...base, tasksCompleted: 1 }),
    ).toBe(true);
    expect(
      evaluateAchievementRule("tasks_completed", { threshold: 10 }, { ...base, tasksCompleted: 9 }),
    ).toBe(false);
    expect(
      evaluateAchievementRule("total_xp", { threshold: 1000 }, { ...base, totalXp: 1000 }),
    ).toBe(true);
    expect(
      evaluateAchievementRule("global_level", { threshold: 5 }, { ...base, globalLevel: 5 }),
    ).toBe(true);
    expect(
      evaluateAchievementRule("streak", { threshold: 7 }, { ...base, maxStreak: 6 }),
    ).toBe(false);
    expect(
      evaluateAchievementRule("quests_completed", { threshold: 1 }, { ...base, questsCompleted: 1 }),
    ).toBe(true);
    expect(
      evaluateAchievementRule("skill_level", { threshold: 5 }, { ...base, maxSkillLevel: 5 }),
    ).toBe(true);
    expect(
      evaluateAchievementRule("attributes_started", { threshold: 6 }, { ...base, attributesStarted: 6 }),
    ).toBe(true);
  });

  it("returns false for an unknown rule type", () => {
    expect(evaluateAchievementRule("nope", { threshold: 1 }, base)).toBe(false);
  });
});
