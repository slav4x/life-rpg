import { z } from "zod";

export const createTaskInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  skillId: z.uuid(),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"),
  baseXp: z.number().int().min(1).max(1000),
  difficulty: z.enum(["easy", "normal", "hard", "epic"]),
  estimatedMinutes: z.number().int().min(1).max(1440).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
