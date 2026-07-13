import { z } from "zod";

const difficulty = z.enum(["easy", "normal", "hard", "epic"]);
const weekdays = z.array(z.number().int().min(1).max(7)).min(1).max(7);

export const createTemplateInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  skillId: z.uuid(),
  baseXp: z.number().int().min(1).max(1000),
  difficulty,
  recurrenceType: z.enum(["daily", "weekdays"]),
  weekdays: weekdays.optional(),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"),
});

export const updateTemplateInputSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    baseXp: z.number().int().min(1).max(1000).optional(),
    difficulty: difficulty.optional(),
    recurrenceType: z.enum(["daily", "weekdays"]).optional(),
    weekdays: weekdays.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty update" });

export type CreateTemplateInput = z.infer<typeof createTemplateInputSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateInputSchema>;
