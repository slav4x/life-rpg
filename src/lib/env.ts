import { z } from "zod";

/**
 * Typed, validated access to the server environment (SPEC §15).
 *
 * This module is server-only — never import it from client components.
 *
 * Stage 0 keeps database and Telegram secrets optional so the project builds
 * and boots without them. Later stages tighten these into required values as
 * the corresponding features land.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.url().optional(),

  // Database (Stage 1+)
  DATABASE_URL: z.string().min(1).optional(),
  POSTGRES_DB: z.string().min(1).optional(),
  POSTGRES_USER: z.string().min(1).optional(),
  POSTGRES_PASSWORD: z.string().min(1).optional(),

  // Telegram auth (Stage 1+)
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  ALLOWED_TELEGRAM_USER_IDS: z.string().optional(),
  TELEGRAM_AUTH_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(86400),

  // Session
  SESSION_COOKIE_NAME: z.string().min(1).default("life_rpg_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // Locale
  DEFAULT_TIMEZONE: z.string().min(1).default("Asia/Novosibirsk"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate an environment source. Exposed as a pure function so the
 * validation rules can be unit-tested without touching `process.env`.
 */
export function parseEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  return parsed.data;
}

const skipValidation =
  process.env.SKIP_ENV_VALIDATION === "1" ||
  process.env.SKIP_ENV_VALIDATION === "true";

export const env: Env = skipValidation
  ? (process.env as unknown as Env)
  : parseEnv();

/** Parsed allowlist of Telegram user IDs (empty until configured). */
export function getAllowedTelegramUserIds(source: Env = env): bigint[] {
  if (!source.ALLOWED_TELEGRAM_USER_IDS) return [];
  return source.ALLOWED_TELEGRAM_USER_IDS.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => BigInt(value));
}
