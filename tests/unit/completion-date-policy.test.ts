import { describe, expect, it } from "vitest";

import {
  assertTaskCompletionDate,
  TASK_BACKDATE_LIMIT_DAYS,
} from "@/application/tasks/completion-date-policy";
import { addDaysToDate } from "@/lib/dates/local-date";

describe("task completion date policy", () => {
  const today = "2026-07-13";

  it("allows today and the seven-day backdating boundary", () => {
    expect(() => assertTaskCompletionDate(today, today)).not.toThrow();
    expect(() =>
      assertTaskCompletionDate(
        addDaysToDate(today, -TASK_BACKDATE_LIMIT_DAYS),
        today,
      ),
    ).not.toThrow();
  });

  it("rejects future and older dates", () => {
    expect(() =>
      assertTaskCompletionDate(addDaysToDate(today, 1), today),
    ).toThrowError(expect.objectContaining({ code: "task_date_future" }));
    expect(() =>
      assertTaskCompletionDate(
        addDaysToDate(today, -(TASK_BACKDATE_LIMIT_DAYS + 1)),
        today,
      ),
    ).toThrowError(expect.objectContaining({ code: "task_date_too_old" }));
  });
});
