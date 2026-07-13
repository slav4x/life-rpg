import { describe, expect, it } from "vitest";

import { createTemplateInputSchema } from "@/lib/validation/task-templates";

describe("task template validation", () => {
  const input = {
    title: "Практика",
    skillId: "00000000-0000-4000-8000-000000000001",
    baseXp: 20,
    difficulty: "normal",
    recurrenceType: "daily",
    localDate: "2026-07-20",
  } as const;

  it("accepts an optional end date on or after the start", () => {
    expect(
      createTemplateInputSchema.safeParse({ ...input, endsOn: "2026-07-20" })
        .success,
    ).toBe(true);
  });

  it("rejects an end date before the start", () => {
    expect(
      createTemplateInputSchema.safeParse({ ...input, endsOn: "2026-07-19" })
        .success,
    ).toBe(false);
  });

  it("accepts supported priorities and rejects unknown values", () => {
    expect(
      createTemplateInputSchema.safeParse({ ...input, priority: "high" }).success,
    ).toBe(true);
    expect(
      createTemplateInputSchema.safeParse({ ...input, priority: "urgent" }).success,
    ).toBe(false);
  });
});
