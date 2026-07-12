import { signInitData } from "@/lib/telegram/init-data";

/** Fixed bot token used to sign test `initData`. Not a real secret. */
export const TEST_BOT_TOKEN = "123456:TEST_BOT_TOKEN";

export interface FixtureUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface CreateInitDataOptions {
  user?: FixtureUser;
  botToken?: string;
  authDate?: Date;
  extra?: Record<string, string>;
}

/**
 * Build a validly-signed Telegram `initData` string for tests and local
 * fixtures (SPEC §18 "auth fixture для тестов").
 */
export function createInitData(options: CreateInitDataOptions = {}): string {
  const user = options.user ?? {
    id: 111_111_111,
    first_name: "Owner",
    username: "owner",
  };
  const botToken = options.botToken ?? TEST_BOT_TOKEN;
  const authDate = options.authDate ?? new Date();

  const fields: Record<string, string> = {
    auth_date: String(Math.floor(authDate.getTime() / 1000)),
    query_id: "AAEtest0000",
    user: JSON.stringify(user),
    ...options.extra,
  };

  return signInitData(fields, botToken);
}
