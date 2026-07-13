import { z } from "zod";

const questType = z.enum(["main", "side", "long_term"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const createQuestInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: questType,
  attributeId: z.uuid().nullish(),
  rewardXp: z.number().int().min(0).max(10000),
  dueDate: isoDate.nullish(),
  manualCompletion: z.boolean().optional(),
  steps: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        isRequired: z.boolean().optional(),
      }),
    )
    .max(30)
    .default([]),
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
    dueDate: isoDate.nullable().optional(),
    manualCompletion: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty update" });

export type CreateQuestInput = z.infer<typeof createQuestInputSchema>;
export type UpdateQuestInput = z.infer<typeof updateQuestInputSchema>;
