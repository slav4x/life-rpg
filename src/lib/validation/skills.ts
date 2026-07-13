import { z } from "zod";

import { SKILL_COLORS, SKILL_ICONS } from "@/domain/game/constants";

const attributeCode = z.enum([
  "body",
  "mind",
  "resources",
  "social",
  "discipline",
  "creation",
]);

export const createSkillInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  attributeCode,
  description: z.string().max(1000).optional(),
  icon: z.enum(SKILL_ICONS).optional(),
  color: z.enum(SKILL_COLORS).optional(),
});

export const updateSkillInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().max(1000).nullable().optional(),
    attributeCode: attributeCode.optional(),
    icon: z.enum(SKILL_ICONS).nullable().optional(),
    color: z.enum(SKILL_COLORS).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty update" });

export type CreateSkillInput = z.infer<typeof createSkillInputSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillInputSchema>;
