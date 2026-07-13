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

  it("accepts template duration and rejects values outside 1–1440", () => {
    const template = {
      title: "Фокус",
      skillKey: "focus",
      baseXp: 20,
      difficulty: "normal",
      recurrenceType: "daily",
      estimatedMinutes: 25,
    } as const;
    expect(
      contentPackSchema.safeParse({ ...base, taskTemplates: [template] }).success,
    ).toBe(true);
    expect(
      contentPackSchema.safeParse({
        ...base,
        taskTemplates: [{ ...template, estimatedMinutes: 0 }],
      }).success,
    ).toBe(false);
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

  it("accepts portable dates and one-off tasks in v2", () => {
    const v2 = {
      ...base,
      formatVersion: 2,
      tasks: [
        {
          title: "Разобрать входящие",
          skillKey: "focus",
          baseXp: 20,
          difficulty: "normal",
          estimatedMinutes: 30,
          scheduledInDays: 2,
        },
      ],
      taskTemplates: [
        {
          title: "Ежедневный фокус",
          skillKey: "focus",
          baseXp: 15,
          difficulty: "easy",
          recurrenceType: "daily",
          startsInDays: 1,
          endsInDays: 30,
        },
      ],
      quests: [
        {
          title: "Закрыть проект",
          type: "main",
          rewardXp: 300,
          dueInDays: 14,
          steps: [{ title: "Сделать результат" }],
        },
      ],
    } as const;

    expect(contentPackSchema.safeParse(v2).success).toBe(true);
    expect(
      contentPackSchema.safeParse({
        ...v2,
        taskTemplates: [
          { ...v2.taskTemplates[0], startsInDays: 10, endsInDays: 5 },
        ],
      }).success,
    ).toBe(false);
    expect(
      contentPackSchema.safeParse({
        ...v2,
        quests: [{ ...v2.quests[0], dueDate: "2026-08-01" }],
      }).success,
    ).toBe(false);
  });
});
