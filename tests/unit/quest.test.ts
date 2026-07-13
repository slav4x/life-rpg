import { describe, expect, it } from "vitest";

import { computeQuestProgress, isQuestType } from "@/domain/game/quest";

describe("computeQuestProgress", () => {
  it("treats an empty quest as fully required-done", () => {
    expect(computeQuestProgress([])).toMatchObject({
      total: 0,
      completed: 0,
      percent: 0,
      allRequiredDone: true,
    });
  });

  it("computes partial progress", () => {
    const p = computeQuestProgress([
      { isRequired: true, completedAt: new Date() },
      { isRequired: true, completedAt: null },
      { isRequired: false, completedAt: null },
    ]);
    expect(p.total).toBe(3);
    expect(p.completed).toBe(1);
    expect(p.percent).toBe(50);
    expect(p.allRequiredDone).toBe(false);
  });

  it("ignores optional steps for allRequiredDone", () => {
    const p = computeQuestProgress([
      { isRequired: true, completedAt: new Date() },
      { isRequired: false, completedAt: null },
    ]);
    expect(p.allRequiredDone).toBe(true);
    expect(p.percent).toBe(100);
  });
});

describe("isQuestType", () => {
  it("validates quest types", () => {
    expect(isQuestType("main")).toBe(true);
    expect(isQuestType("long_term")).toBe(true);
    expect(isQuestType("epic")).toBe(false);
  });
});
