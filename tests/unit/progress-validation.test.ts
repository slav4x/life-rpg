import { describe, expect, it } from "vitest";

import { weeklyFocusInputSchema } from "@/lib/validation/progress";

describe("weekly focus validation", () => {
  it("accepts a bounded focus for a real calendar date", () => {
    expect(
      weeklyFocusInputSchema.safeParse({
        weekStart: "2026-07-20",
        focus: "Закончить ключевой этап",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid dates and oversized focus text", () => {
    expect(
      weeklyFocusInputSchema.safeParse({ weekStart: "2026-02-31", focus: "x" })
        .success,
    ).toBe(false);
    expect(
      weeklyFocusInputSchema.safeParse({
        weekStart: "2026-07-20",
        focus: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
});
