import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

/**
 * Server-side verification of Telegram Mini App `initData` (SPEC §9.1).
 *
 * Never trust `initDataUnsafe` or any Telegram ID sent as JSON by the client —
 * only values proven authentic by this module may be used.
 */

const telegramUserSchema = z.object({
  id: z.number().int(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  language_code: z.string().optional(),
  is_premium: z.boolean().optional(),
});

export type TelegramUser = z.infer<typeof telegramUserSchema>;

export interface VerifiedInitData {
  user: TelegramUser;
  authDate: Date;
}

export class InitDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InitDataError";
  }
}

/**
 * Build the Telegram data-check-string: every field except `hash` and
 * `signature`, sorted alphabetically and joined by newlines. `signature` is a
 * separate Ed25519 field that Telegram excludes from the HMAC `hash`.
 */
function buildDataCheckString(params: URLSearchParams): string {
  const pairs: string[] = [];
  for (const [key, value] of params) {
    if (key === "hash" || key === "signature") continue;
    pairs.push(`${key}=${value}`);
  }
  return pairs.sort().join("\n");
}

function computeHash(dataCheckString: string, botToken: string): Buffer {
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  return createHmac("sha256", secretKey).update(dataCheckString).digest();
}

export interface VerifyOptions {
  /** Reject data whose `auth_date` is older than this many seconds. */
  maxAgeSeconds: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

export function verifyInitData(
  initData: string,
  botToken: string,
  options: VerifyOptions,
): VerifiedInitData {
  if (!botToken) {
    throw new InitDataError("bot token is not configured");
  }

  const params = new URLSearchParams(initData);

  const providedHashHex = params.get("hash");
  if (!providedHashHex) {
    throw new InitDataError("missing hash");
  }

  const expected = computeHash(buildDataCheckString(params), botToken);
  const provided = Buffer.from(providedHashHex, "hex");
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    throw new InitDataError("signature mismatch");
  }

  const authDateRaw = params.get("auth_date");
  const authDateSeconds = Number(authDateRaw);
  if (!authDateRaw || !Number.isFinite(authDateSeconds)) {
    throw new InitDataError("missing or invalid auth_date");
  }
  const authDate = new Date(authDateSeconds * 1000);
  const nowMs = (options.now ?? Date.now)();
  const ageSeconds = (nowMs - authDate.getTime()) / 1000;
  if (ageSeconds > options.maxAgeSeconds) {
    throw new InitDataError("auth_date expired");
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    throw new InitDataError("missing user");
  }
  let userJson: unknown;
  try {
    userJson = JSON.parse(userRaw);
  } catch {
    throw new InitDataError("invalid user payload");
  }
  const parsedUser = telegramUserSchema.safeParse(userJson);
  if (!parsedUser.success) {
    throw new InitDataError("invalid user payload");
  }

  return { user: parsedUser.data, authDate };
}

/**
 * Produce a validly-signed `initData` string. Used only by tests and local
 * fixtures — production never signs on behalf of Telegram.
 */
export function signInitData(
  fields: Record<string, string>,
  botToken: string,
): string {
  const params = new URLSearchParams(fields);
  const hash = computeHash(buildDataCheckString(params), botToken).toString(
    "hex",
  );
  params.set("hash", hash);
  return params.toString();
}
