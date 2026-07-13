import { describe, expect, it } from "vitest";

import { computeStreakFromDates } from "@/domain/game/streak";

describe("computeStreakFromDates", () => {
  it("returns zero for no completions", () => {
    expect(computeStreakFromDates([])).toEqual({
      current: 0,
      best: 0,
      last: null,
    });
  });

  it("counts a single day", () => {
    expect(computeStreakFromDates(["2026-07-13"])).toEqual({
      current: 1,
      best: 1,
      last: "2026-07-13",
    });
  });

  it("increments across consecutive days", () => {
    expect(
      computeStreakFromDates(["2026-07-11", "2026-07-12", "2026-07-13"]),
    ).toEqual({ current: 3, best: 3, last: "2026-07-13" });
  });

  it("resets current on a gap but keeps best", () => {
    expect(
      computeStreakFromDates(["2026-07-11", "2026-07-12", "2026-07-15"]),
    ).toEqual({ current: 1, best: 2, last: "2026-07-15" });
  });

  it("dedupes and sorts unordered input", () => {
    expect(
      computeStreakFromDates([
        "2026-07-13",
        "2026-07-11",
        "2026-07-12",
        "2026-07-13",
      ]),
    ).toEqual({ current: 3, best: 3, last: "2026-07-13" });
  });

  it("handles month boundaries", () => {
    expect(computeStreakFromDates(["2026-07-31", "2026-08-01"])).toEqual({
      current: 2,
      best: 2,
      last: "2026-08-01",
    });
  });
});
