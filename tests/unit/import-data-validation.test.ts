import { describe, expect, it } from "vitest";

import { contentPackSchema } from "@/lib/validation/import-data";

describe("content pack validation", () => {
  const base = {
    format: "life-rpg-content-pack",
    formatVersion: 1,
    name: "Пак",
    skills: [
      { key: "focus", name: "Фокус 2", attributeCode: "discipline" },
    ],
    taskTemplates: [],
    quests: [],
  } as const;

  it("accepts a valid pack", () => {
    expect(contentPackSchema.safeParse(base).success).toBe(true);
  });

  it("rejects duplicate skill keys and unresolved references", () => {
    const result = contentPackSchema.safeParse({
      ...base,
      skills: [...base.skills, { ...base.skills[0], name: "Другой" }],
      taskTemplates: [
        {
          title: "Задача",
          skillKey: "missing",
          baseXp: 20,
          difficulty: "normal",
          recurrenceType: "daily",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
