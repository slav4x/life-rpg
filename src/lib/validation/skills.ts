import { z } from "zod";

const attributeCode = z.enum([
  "body",
  "mind",
  "resources",
  "social",
  "discipline",
  "creation",
]);

export const createSkillInputSchema = z.object({
  name: z.string().min(1).max(80),
  attributeCode,
  description: z.string().max(1000).optional(),
});

export const updateSkillInputSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    description: z.string().max(1000).nullable().optional(),
    attributeCode: attributeCode.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty update" });

export type CreateSkillInput = z.infer<typeof createSkillInputSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillInputSchema>;
