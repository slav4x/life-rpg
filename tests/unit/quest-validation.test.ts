import { describe, expect, it } from "vitest";

import {
  createQuestInputSchema,
  updateQuestInputSchema,
} from "@/lib/validation/quests";

describe("quest validation", () => {
  it("requires at least one step and one required step", () => {
    const base = {
      title: "Квест",
      type: "main",
      rewardXp: 250,
      steps: [],
    };

    expect(createQuestInputSchema.safeParse(base).success).toBe(false);
    expect(
      createQuestInputSchema.safeParse({
        ...base,
        steps: [{ title: "Опциональный", isRequired: false }],
      }).success,
    ).toBe(false);
    expect(
      createQuestInputSchema.safeParse({
        ...base,
        steps: [{ title: "Обязательный" }],
      }).success,
    ).toBe(true);
  });

  it("rejects invalid dates and duplicate edited step ids", () => {
    const id = "11111111-1111-4111-8111-111111111111";

    expect(
      updateQuestInputSchema.safeParse({ dueDate: "2026-02-31" }).success,
    ).toBe(false);
    expect(
      updateQuestInputSchema.safeParse({
        steps: [
          { id, title: "Первый", isRequired: true },
          { id, title: "Дубль", isRequired: true },
        ],
      }).success,
    ).toBe(false);
  });
});
