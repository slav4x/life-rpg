import { getDb, type Database } from "@/db/client";
import { createSession } from "@/db/repositories/sessions";
import { upsertUserFromTelegram } from "@/db/repositories/users";
import type { User } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { generateSessionToken, hashSessionToken } from "@/lib/auth/tokens";
import { env, getAllowedTelegramUserIds } from "@/lib/env";
import { InitDataError, verifyInitData } from "@/lib/telegram/init-data";

const DAY_MS = 86_400_000;

export interface AuthResult {
  user: User;
  token: string;
  expiresAt: Date;
}

/**
 * Dependencies of {@link authenticateWithTelegram}. Injected so the flow can be
 * integration-tested against a throwaway database without global env state.
 */
export interface AuthDeps {
  db: Database;
  botToken: string;
  allowedTelegramIds: bigint[];
  maxAgeSeconds: number;
  sessionTtlDays: number;
  now: () => Date;
}

export function defaultAuthDeps(): AuthDeps {
  return {
    db: getDb(),
    botToken: env.TELEGRAM_BOT_TOKEN ?? "",
    allowedTelegramIds: getAllowedTelegramUserIds(),
    maxAgeSeconds: env.TELEGRAM_AUTH_MAX_AGE_SECONDS,
    sessionTtlDays: env.SESSION_TTL_DAYS,
    now: () => new Date(),
  };
}

/**
 * Verify Telegram `initData`, enforce the allowlist, upsert the user and open a
 * server session (SPEC §9.1). All XP/game state is out of scope here.
 */
export async function authenticateWithTelegram(
  initData: string,
  deps: AuthDeps = defaultAuthDeps(),
): Promise<AuthResult> {
  if (!deps.botToken) {
    throw new AuthError(
      "invalid_init_data",
      "Telegram bot token is not configured",
    );
  }

  let verified;
  try {
    verified = verifyInitData(initData, deps.botToken, {
      maxAgeSeconds: deps.maxAgeSeconds,
      now: () => deps.now().getTime(),
    });
  } catch (error) {
    if (error instanceof InitDataError) {
      throw new AuthError("invalid_init_data", error.message);
    }
    throw error;
  }

  const telegramId = BigInt(verified.user.id);
  if (!deps.allowedTelegramIds.includes(telegramId)) {
    throw new AuthError("forbidden", "Telegram user is not allowed");
  }

  const user = await upsertUserFromTelegram(deps.db, {
    telegramId,
    firstName: verified.user.first_name,
    lastName: verified.user.last_name ?? null,
    telegramUsername: verified.user.username ?? null,
    photoUrl: verified.user.photo_url ?? null,
  });

  const token = generateSessionToken();
  const expiresAt = new Date(deps.now().getTime() + deps.sessionTtlDays * DAY_MS);
  await createSession(deps.db, {
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });

  return { user, token, expiresAt };
}
