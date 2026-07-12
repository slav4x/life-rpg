import { describe, expect, it } from "vitest";

import {
  calculateAttributeXp,
  calculateFinalXp,
  calculateXpBreakdown,
} from "@/domain/game/calculate-xp";

describe("calculateFinalXp", () => {
  it("applies difficulty multipliers with rounding (SPEC §5.5)", () => {
    expect(calculateFinalXp(50, "normal")).toBe(50);
    expect(calculateFinalXp(50, "easy")).toBe(40);
    expect(calculateFinalXp(50, "hard")).toBe(65);
    expect(calculateFinalXp(50, "epic")).toBe(75);
    // 33 * 1.3 = 42.9 -> 43
    expect(calculateFinalXp(33, "hard")).toBe(43);
  });
});

describe("calculateAttributeXp", () => {
  it("credits 25% of the final XP, rounded", () => {
    expect(calculateAttributeXp(40)).toBe(10);
    expect(calculateAttributeXp(50)).toBe(13); // 12.5 -> 13
    expect(calculateAttributeXp(65)).toBe(16); // 16.25 -> 16
  });
});

describe("calculateXpBreakdown", () => {
  it("splits XP across global, skill and attribute", () => {
    expect(calculateXpBreakdown(50, "normal")).toEqual({
      global: 50,
      skill: 50,
      attribute: 13,
      multiplier: 1.0,
    });
  });
});
