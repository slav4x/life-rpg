import { z } from "zod";

import { baseXpSchema, estimatedMinutesSchema, isoDateSchema } from "./common";

const difficulty = z.enum(["easy", "normal", "hard", "epic"]);
const weekdays = z.array(z.number().int().min(1).max(7)).min(1).max(7);

export const createTemplateInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(2000).optional(),
    skillId: z.uuid(),
    baseXp: baseXpSchema,
    difficulty,
    recurrenceType: z.enum(["daily", "weekdays"]),
    weekdays: weekdays.optional(),
    estimatedMinutes: estimatedMinutesSchema.optional(),
    localDate: isoDateSchema,
  })
  .refine((v) => v.recurrenceType !== "weekdays" || Boolean(v.weekdays), {
    message: "weekdays are required for the weekdays recurrence",
    path: ["weekdays"],
  });

export const updateTemplateInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    skillId: z.uuid().optional(),
    baseXp: baseXpSchema.optional(),
    difficulty: difficulty.optional(),
    recurrenceType: z.enum(["daily", "weekdays"]).optional(),
    weekdays: weekdays.nullable().optional(),
    estimatedMinutes: estimatedMinutesSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty update" })
  // Switching to the weekdays recurrence must include the days.
  .refine(
    (v) =>
      v.recurrenceType !== "weekdays" ||
      (Array.isArray(v.weekdays) && v.weekdays.length > 0),
    { message: "weekdays are required for the weekdays recurrence", path: ["weekdays"] },
  );

export type CreateTemplateInput = z.infer<typeof createTemplateInputSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateInputSchema>;
