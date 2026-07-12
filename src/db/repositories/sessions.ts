import { and, eq, gt } from "drizzle-orm";

import type { Database } from "@/db/client";
import { sessions, users, type Session, type User } from "@/db/schema";

export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export async function createSession(
  db: Database,
  input: CreateSessionInput,
): Promise<Session> {
  const [session] = await db.insert(sessions).values(input).returning();
  return session;
}

export interface SessionWithUser {
  session: Session;
  user: User;
}

/** Return the session and its owner only if the session has not expired. */
export async function findActiveSessionByTokenHash(
  db: Database,
  tokenHash: string,
  now: Date = new Date(),
): Promise<SessionWithUser | undefined> {
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);
  return row;
}

export async function touchSession(
  db: Database,
  sessionId: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(sessions)
    .set({ lastUsedAt: now })
    .where(eq(sessions.id, sessionId));
}

export async function deleteSessionByTokenHash(
  db: Database,
  tokenHash: string,
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}
