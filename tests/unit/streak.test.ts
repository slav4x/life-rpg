import { describe, expect, it } from "vitest";

import {
  computeStreak,
  displayCurrentStreak,
  isStreakAlive,
} from "@/domain/game/streak";

const daily = { recurrenceType: "daily", weekdays: null };
const mwf = { recurrenceType: "weekdays", weekdays: [1, 3, 5] }; // Mon/Wed/Fri

describe("computeStreak — daily", () => {
  it("returns zero for no completions", () => {
    expect(computeStreak([], daily)).toEqual({
      current: 0,
      best: 0,
      last: null,
    });
  });

  it("counts consecutive days and resets on a gap", () => {
    expect(
      computeStreak(["2026-07-11", "2026-07-12", "2026-07-13"], daily),
    ).toEqual({ current: 3, best: 3, last: "2026-07-13" });
    expect(
      computeStreak(["2026-07-11", "2026-07-12", "2026-07-15"], daily),
    ).toEqual({ current: 1, best: 2, last: "2026-07-15" });
  });

  it("dedupes and sorts unordered input", () => {
    expect(
      computeStreak(
        ["2026-07-13", "2026-07-11", "2026-07-12", "2026-07-13"],
        daily,
      ),
    ).toEqual({ current: 3, best: 3, last: "2026-07-13" });
  });
});

describe("computeStreak — weekdays schedule-aware", () => {
  it("treats scheduled occurrences as consecutive (Mon/Wed/Fri)", () => {
    // 2024-01-01 is Monday.
    expect(
      computeStreak(["2024-01-01", "2024-01-03", "2024-01-05"], mwf),
    ).toEqual({ current: 3, best: 3, last: "2024-01-05" });
  });

  it("breaks when a scheduled day is missed", () => {
    // Missing Wed (01-03) between Mon and Fri.
    expect(computeStreak(["2024-01-01", "2024-01-05"], mwf)).toEqual({
      current: 1,
      best: 1,
      last: "2024-01-05",
    });
  });
});

describe("isStreakAlive / displayCurrentStreak", () => {
  it("stays alive through today's grace window", () => {
    expect(isStreakAlive(daily, "2026-07-13", "2026-07-13")).toBe(true);
    expect(isStreakAlive(daily, "2026-07-12", "2026-07-13")).toBe(true);
  });

  it("breaks once a scheduled day is missed", () => {
    expect(isStreakAlive(daily, "2026-07-10", "2026-07-13")).toBe(false);
    expect(displayCurrentStreak(5, daily, "2026-07-10", "2026-07-13")).toBe(0);
    expect(displayCurrentStreak(5, daily, "2026-07-12", "2026-07-13")).toBe(5);
  });

  it("respects the weekday schedule for aliveness", () => {
    // Last done Fri (01-05); next scheduled is Mon (01-08). Still alive Sat.
    expect(isStreakAlive(mwf, "2024-01-05", "2024-01-06")).toBe(true);
    // By next Tue (01-09) the Monday occurrence was missed.
    expect(isStreakAlive(mwf, "2024-01-05", "2024-01-09")).toBe(false);
  });
});
