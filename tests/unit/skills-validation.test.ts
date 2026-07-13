import { describe, expect, it } from "vitest";

import {
  createSkillInputSchema,
  updateSkillInputSchema,
} from "@/lib/validation/skills";

describe("skill input validation", () => {
  it("accepts curated icons and colors", () => {
    expect(
      createSkillInputSchema.safeParse({
        name: "TypeScript",
        attributeCode: "mind",
        icon: "🧠",
        color: "#6366F1",
      }).success,
    ).toBe(true);
  });

  it("rejects arbitrary icon and color values", () => {
    expect(
      updateSkillInputSchema.safeParse({ icon: "<svg>", color: "red" }).success,
    ).toBe(false);
  });
});
