import { z } from "zod";

export const createSkillInputSchema = z.object({
  name: z.string().min(1).max(80),
  attributeCode: z.enum([
    "body",
    "mind",
    "resources",
    "social",
    "discipline",
    "creation",
  ]),
  description: z.string().max(1000).optional(),
});

export type CreateSkillInput = z.infer<typeof createSkillInputSchema>;
