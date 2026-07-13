import { z } from "zod";

import { isoDateSchema } from "./common";

const questType = z.enum(["main", "side", "long_term"]);

export const createQuestInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: questType,
  attributeId: z.uuid().nullish(),
  rewardXp: z.number().int().min(0).max(10000),
  dueDate: isoDateSchema.nullish(),
  manualCompletion: z.boolean().optional(),
  // A quest is a goal made of one or more measurable steps (SPEC §5.7).
  steps: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        isRequired: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(30),
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
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty update" });

export type CreateQuestInput = z.infer<typeof createQuestInputSchema>;
export type UpdateQuestInput = z.infer<typeof updateQuestInputSchema>;
