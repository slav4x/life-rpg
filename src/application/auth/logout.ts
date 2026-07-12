import { getDb } from "@/db/client";
import { deleteSessionByTokenHash } from "@/db/repositories/sessions";
import { clearSessionCookie, readSessionToken } from "@/lib/auth/cookies";
import { hashSessionToken } from "@/lib/auth/tokens";

/** Revoke the current session server-side and clear the cookie. */
export async function logout(): Promise<void> {
  const token = await readSessionToken();
  if (token) {
    await deleteSessionByTokenHash(getDb(), hashSessionToken(token));
  }
  await clearSessionCookie();
}
