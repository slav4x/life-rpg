import { describe, expect, it } from "vitest";

import {
  getAllowedTelegramUserIds,
  isDevAuthBypassEnabled,
  parseEnv,
} from "@/lib/env";

describe("parseEnv", () => {
  it("applies defaults for optional configuration", () => {
    const env = parseEnv({});

    expect(env.NODE_ENV).toBe("development");
    expect(env.SESSION_COOKIE_NAME).toBe("life_rpg_session");
    expect(env.SESSION_TTL_DAYS).toBe(30);
    expect(env.TELEGRAM_AUTH_MAX_AGE_SECONDS).toBe(86400);
    expect(env.DEFAULT_TIMEZONE).toBe("Asia/Novosibirsk");
  });

  it("coerces numeric values from strings", () => {
    const env = parseEnv({ SESSION_TTL_DAYS: "45" });

    expect(env.SESSION_TTL_DAYS).toBe(45);
  });

  it("rejects an invalid APP_URL", () => {
    expect(() => parseEnv({ APP_URL: "not-a-url" })).toThrow(
      /Invalid environment variables/,
    );
  });

  it("rejects a non-positive session ttl", () => {
    expect(() => parseEnv({ SESSION_TTL_DAYS: "0" })).toThrow(
      /Invalid environment variables/,
    );
  });
});

describe("getAllowedTelegramUserIds", () => {
  it("returns an empty list when unset", () => {
    const env = parseEnv({});

    expect(getAllowedTelegramUserIds(env)).toEqual([]);
  });

  it("parses a comma-separated allowlist into bigints", () => {
    const env = parseEnv({
      ALLOWED_TELEGRAM_USER_IDS: "123456789, 987654321",
    });

    expect(getAllowedTelegramUserIds(env)).toEqual([123456789n, 987654321n]);
  });
});

describe("isDevAuthBypassEnabled", () => {
  it("is enabled with the flag in development", () => {
    expect(
      isDevAuthBypassEnabled(
        parseEnv({ DEV_AUTH_BYPASS: "1", NODE_ENV: "development" }),
      ),
    ).toBe(true);
    expect(
      isDevAuthBypassEnabled(
        parseEnv({ DEV_AUTH_BYPASS: "true", NODE_ENV: "development" }),
      ),
    ).toBe(true);
  });

  it("is always disabled in production", () => {
    expect(
      isDevAuthBypassEnabled(
        parseEnv({ DEV_AUTH_BYPASS: "1", NODE_ENV: "production" }),
      ),
    ).toBe(false);
  });

  it("is disabled without the flag", () => {
    expect(
      isDevAuthBypassEnabled(parseEnv({ NODE_ENV: "development" })),
    ).toBe(false);
  });
});
