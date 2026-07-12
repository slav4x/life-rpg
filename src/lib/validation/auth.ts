import { z } from "zod";

/** Body of `POST /api/auth/telegram`. Length-bounded per SPEC §9.3. */
export const telegramAuthInputSchema = z.object({
  initData: z.string().min(1).max(4096),
});

export type TelegramAuthInput = z.infer<typeof telegramAuthInputSchema>;
