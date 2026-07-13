import { z } from "zod";

import { baseXpSchema, estimatedMinutesSchema, isoDateSchema } from "./common";

const difficulty = z.enum(["easy", "normal", "hard", "epic"]);
const priority = z.enum(["high", "normal", "low"]);

export const createTaskInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  skillId: z.uuid(),
  localDate: isoDateSchema,
  baseXp: baseXpSchema,
  difficulty,
  priority: priority.optional(),
  estimatedMinutes: estimatedMinutesSchema.optional(),
  questStepId: z.uuid().optional(),
});

export const updateTaskInputSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    skillId: z.uuid().optional(),
    localDate: isoDateSchema.optional(),
    baseXp: baseXpSchema.optional(),
    difficulty: difficulty.optional(),
    priority: priority.optional(),
    estimatedMinutes: estimatedMinutesSchema.nullable().optional(),
    focused: z.boolean().optional(),
    // "this" edits the task; "future" also updates its template (SPEC §6.3).
    scope: z.enum(["this", "future"]).optional(),
  })
  .refine((v) => Object.keys(v).some((k) => k !== "scope"), {
    message: "empty update",
  });

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

const overdueTaskIds = z
  .array(z.uuid())
  .min(1)
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "task ids must be unique",
  });

export const resolveOverdueTasksInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reschedule"),
    taskIds: overdueTaskIds,
    targetDate: isoDateSchema,
  }),
  z.object({
    action: z.literal("dismiss"),
    taskIds: overdueTaskIds,
    scope: z.enum(["this", "future"]).default("this"),
  }),
]);

export type ResolveOverdueTasksInput = z.infer<
  typeof resolveOverdueTasksInputSchema
>;
