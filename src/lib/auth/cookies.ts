import { cookies } from "next/headers";

import { env } from "@/lib/env";

/**
 * HttpOnly session cookie management (SPEC §9.1).
 *
 * `SameSite=Lax` follows the spec. Note: Telegram Web (desktop) embeds the Mini
 * App in a cross-site iframe where Lax cookies are not sent; the mobile Telegram
 * clients (the primary target, SPEC §19) run the app top-level, where Lax works.
 */
export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const store = await cookies();
  store.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(env.SESSION_COOKIE_NAME);
}

export async function readSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(env.SESSION_COOKIE_NAME)?.value;
}
