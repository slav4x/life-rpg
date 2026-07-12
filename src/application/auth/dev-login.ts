import { getDb, type Database } from "@/db/client";
import { createSession } from "@/db/repositories/sessions";
import { upsertUserFromTelegram } from "@/db/repositories/users";
import type { User } from "@/db/schema";
import { generateSessionToken, hashSessionToken } from "@/lib/auth/tokens";
import { env } from "@/lib/env";

const DAY_MS = 86_400_000;
const DEFAULT_DEV_TELEGRAM_ID = 424_242;

export interface DevSignInResult {
  user: User;
  token: string;
  expiresAt: Date;
}

/**
 * Development-only sign-in: upsert a mock user and open a real session,
 * skipping Telegram verification and the allowlist. Callers must gate this
 * behind {@link isDevAuthBypassEnabled}.
 */
export async function devSignIn(db: Database = getDb()): Promise<DevSignInResult> {
  const user = await upsertUserFromTelegram(db, {
    telegramId: BigInt(env.DEV_TELEGRAM_ID ?? DEFAULT_DEV_TELEGRAM_ID),
    firstName: env.DEV_FIRST_NAME ?? "Dev",
    telegramUsername: "dev",
  });

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * DAY_MS);
  await createSession(db, {
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });

  return { user, token, expiresAt };
}
