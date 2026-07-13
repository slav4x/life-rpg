import { describe, expect, it } from "vitest";

import {
  isRecurrenceType,
  templateAppliesOnWeekday,
} from "@/domain/game/recurrence";

describe("templateAppliesOnWeekday", () => {
  it("daily applies every weekday", () => {
    for (let d = 1; d <= 7; d++) {
      expect(
        templateAppliesOnWeekday(
          { recurrenceType: "daily", weekdays: null },
          d,
        ),
      ).toBe(true);
    }
  });

  it("weekdays applies only to the selected days", () => {
    const rule = { recurrenceType: "weekdays", weekdays: [1, 3, 5] };
    expect(templateAppliesOnWeekday(rule, 1)).toBe(true);
    expect(templateAppliesOnWeekday(rule, 2)).toBe(false);
    expect(templateAppliesOnWeekday(rule, 5)).toBe(true);
    expect(templateAppliesOnWeekday(rule, 7)).toBe(false);
  });

  it("weekdays with no days selected never applies", () => {
    expect(
      templateAppliesOnWeekday(
        { recurrenceType: "weekdays", weekdays: null },
        3,
      ),
    ).toBe(false);
  });
});

describe("isRecurrenceType", () => {
  it("accepts known types", () => {
    expect(isRecurrenceType("daily")).toBe(true);
    expect(isRecurrenceType("weekdays")).toBe(true);
    expect(isRecurrenceType("monthly")).toBe(false);
  });
});
