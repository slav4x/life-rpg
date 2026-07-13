import { z } from "zod";

import { isoDateSchema } from "./common";

const questType = z.enum(["main", "side", "long_term"]);

const createQuestStepSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  isRequired: z.boolean().optional(),
});

const updateQuestStepSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  isRequired: z.boolean(),
});

function hasRequiredStep(steps: { isRequired?: boolean }[]): boolean {
  return steps.some((step) => step.isRequired !== false);
}

export const createQuestInputSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    type: questType,
    status: z.enum(["draft", "active"]).optional(),
    attributeId: z.uuid().nullish(),
    rewardXp: z.number().int().min(0).max(10000),
    dueDate: isoDateSchema.nullish(),
    manualCompletion: z.boolean().optional(),
    // A quest is a goal made of one or more measurable steps (SPEC §5.7).
    steps: z.array(createQuestStepSchema).min(1).max(30),
  })
  .refine((value) => hasRequiredStep(value.steps), {
    path: ["steps"],
    message: "at least one required step is needed",
  });

export const updateQuestInputSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    type: questType.optional(),
    // Completion goes through the dedicated endpoint, not PATCH.
    status: z.enum(["draft", "active", "archived"]).optional(),
    attributeId: z.uuid().nullable().optional(),
    rewardXp: z.number().int().min(0).max(10000).optional(),
    dueDate: isoDateSchema.nullable().optional(),
    manualCompletion: z.boolean().optional(),
    steps: z.array(updateQuestStepSchema).min(1).max(30).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty update" })
  .refine((v) => !v.steps || hasRequiredStep(v.steps), {
    path: ["steps"],
    message: "at least one required step is needed",
  })
  .refine(
    (v) => {
      const ids = v.steps?.flatMap((step) => (step.id ? [step.id] : [])) ?? [];
      return new Set(ids).size === ids.length;
    },
    { path: ["steps"], message: "duplicate step ids" },
  );

export type CreateQuestInput = z.infer<typeof createQuestInputSchema>;
export type UpdateQuestInput = z.infer<typeof updateQuestInputSchema>;
