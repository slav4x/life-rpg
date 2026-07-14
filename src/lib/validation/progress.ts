import { z } from "zod";

import { isoDateSchema } from "./common";

export const weeklyFocusInputSchema = z.object({
  weekStart: isoDateSchema,
  focus: z.string().trim().max(500),
});

export type WeeklyFocusInput = z.infer<typeof weeklyFocusInputSchema>;
