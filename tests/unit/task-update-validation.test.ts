import { describe, expect, it } from "vitest";

import { updateTaskInputSchema } from "@/lib/validation/tasks";

describe("task update validation", () => {
  it("accepts focus as a standalone task update", () => {
    expect(updateTaskInputSchema.safeParse({ focused: true }).success).toBe(true);
    expect(updateTaskInputSchema.safeParse({ focused: false }).success).toBe(true);
  });

  it("still rejects an empty task update", () => {
    expect(updateTaskInputSchema.safeParse({}).success).toBe(false);
    expect(updateTaskInputSchema.safeParse({ scope: "this" }).success).toBe(false);
  });
});
