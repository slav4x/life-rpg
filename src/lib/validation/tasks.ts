import { z } from "zod";

import { baseXpSchema, estimatedMinutesSchema, isoDateSchema } from "./common";

const difficulty = z.enum(["easy", "normal", "hard", "epic"]);

export const createTaskInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  skillId: z.uuid(),
  localDate: isoDateSchema,
  baseXp: baseXpSchema,
  difficulty,
  estimatedMinutes: estimatedMinutesSchema.optional(),
});

export const updateTaskInputSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    skillId: z.uuid().optional(),
    localDate: isoDateSchema.optional(),
    baseXp: baseXpSchema.optional(),
    difficulty: difficulty.optional(),
    estimatedMinutes: estimatedMinutesSchema.nullable().optional(),
    // "this" edits the task; "future" also updates its template (SPEC §6.3).
    scope: z.enum(["this", "future"]).optional(),
  })
  .refine((v) => Object.keys(v).some((k) => k !== "scope"), {
    message: "empty update",
  });

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;
