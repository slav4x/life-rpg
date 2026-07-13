import { describe, expect, it } from "vitest";

import { resolveOverdueTasksInputSchema } from "@/lib/validation/tasks";

const taskId = "00000000-0000-4000-8000-000000000001";

describe("overdue task action validation", () => {
  it("accepts bounded reschedule and dismiss operations", () => {
    expect(
      resolveOverdueTasksInputSchema.safeParse({
        action: "reschedule",
        taskIds: [taskId],
        targetDate: "2026-07-20",
      }).success,
    ).toBe(true);
    expect(
      resolveOverdueTasksInputSchema.safeParse({
        action: "dismiss",
        taskIds: [taskId],
        scope: "future",
      }).success,
    ).toBe(true);
  });

  it("rejects duplicate ids and invalid calendar dates", () => {
    expect(
      resolveOverdueTasksInputSchema.safeParse({
        action: "dismiss",
        taskIds: [taskId, taskId],
      }).success,
    ).toBe(false);
    expect(
      resolveOverdueTasksInputSchema.safeParse({
        action: "reschedule",
        taskIds: [taskId],
        targetDate: "2026-02-31",
      }).success,
    ).toBe(false);
  });
});
