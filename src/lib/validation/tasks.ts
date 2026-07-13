import { z } from "zod";

import { isoDateSchema } from "./common";

export const createTaskInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  skillId: z.uuid(),
  localDate: isoDateSchema,
  baseXp: z.number().int().min(1).max(1000),
  difficulty: z.enum(["easy", "normal", "hard", "epic"]),
  estimatedMinutes: z.number().int().min(1).max(1440).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
