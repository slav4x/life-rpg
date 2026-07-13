import { z } from "zod";

export const updateProfileInputSchema = z
  .object({
    theme: z.enum(["light", "dark", "system"]).optional(),
    timezone: z.string().min(1).max(64).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty update" });

export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;
