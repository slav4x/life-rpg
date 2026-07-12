import { getDb } from "@/db/client";
import {
  findActiveSessionByTokenHash,
  touchSession,
} from "@/db/repositories/sessions";
import type { User } from "@/db/schema";
import { readSessionToken } from "@/lib/auth/cookies";
import { hashSessionToken } from "@/lib/auth/tokens";

// Refresh last_used_at at most once per hour to avoid write amplification (SPEC §9.2).
const TOUCH_THROTTLE_MS = 60 * 60 * 1000;

/**
 * Resolve the current user from the session cookie, or null if unauthenticated.
 * Skips the database entirely when no cookie is present.
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  const token = await readSessionToken();
  if (!token) return null;

  const db = getDb();
  const found = await findActiveSessionByTokenHash(db, hashSessionToken(token));
  if (!found) return null;

  const { session, user } = found;
  if (Date.now() - session.lastUsedAt.getTime() > TOUCH_THROTTLE_MS) {
    await touchSession(db, session.id);
  }
  return user;
}
