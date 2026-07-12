import { describe, expect, it } from "vitest";

import {
  calculateLevel,
  levelProgress,
  xpRequiredForLevel,
} from "@/domain/game/calculate-level";

describe("xpRequiredForLevel", () => {
  it("matches the SPEC §5.1 table", () => {
    expect(xpRequiredForLevel(1)).toBe(0);
    expect(xpRequiredForLevel(2)).toBe(400);
    expect(xpRequiredForLevel(3)).toBe(900);
    expect(xpRequiredForLevel(5)).toBe(2500);
    expect(xpRequiredForLevel(10)).toBe(10000);
  });
});

describe("calculateLevel", () => {
  it("starts everyone at level 1", () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(399)).toBe(1);
  });

  it("crosses thresholds exactly", () => {
    expect(calculateLevel(400)).toBe(2);
    expect(calculateLevel(899)).toBe(2);
    expect(calculateLevel(900)).toBe(3);
    expect(calculateLevel(2500)).toBe(5);
    expect(calculateLevel(10000)).toBe(10);
  });

  it("never returns below 1 for negative input", () => {
    expect(calculateLevel(-50)).toBe(1);
  });
});

describe("levelProgress", () => {
  it("reports progress inside level 1", () => {
    const p = levelProgress(100);
    expect(p.level).toBe(1);
    expect(p.currentLevelXp).toBe(0);
    expect(p.nextLevelXp).toBe(400);
    expect(p.xpIntoLevel).toBe(100);
    expect(p.xpForNextLevel).toBe(400);
    expect(p.ratio).toBeCloseTo(0.25);
  });

  it("reports progress inside a higher level", () => {
    const p = levelProgress(650);
    expect(p.level).toBe(2);
    expect(p.currentLevelXp).toBe(400);
    expect(p.nextLevelXp).toBe(900);
    expect(p.xpIntoLevel).toBe(250);
    expect(p.ratio).toBeCloseTo(0.5);
  });
});
