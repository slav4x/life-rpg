import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { users, type User } from "@/db/schema";

export interface UpsertUserInput {
  telegramId: bigint;
  firstName: string;
  lastName?: string | null;
  telegramUsername?: string | null;
  photoUrl?: string | null;
}

/**
 * Insert the user or refresh their Telegram profile fields on conflict.
 * Keyed by the unique `telegram_id` so repeated logins never duplicate a user.
 */
export async function upsertUserFromTelegram(
  db: Database,
  input: UpsertUserInput,
): Promise<User> {
  const now = new Date();
  const profile = {
    firstName: input.firstName,
    lastName: input.lastName ?? null,
    telegramUsername: input.telegramUsername ?? null,
    photoUrl: input.photoUrl ?? null,
    updatedAt: now,
  };

  const [user] = await db
    .insert(users)
    .values({ telegramId: input.telegramId, ...profile })
    .onConflictDoUpdate({ target: users.telegramId, set: profile })
    .returning();

  return user;
}

export async function findUserById(
  db: Database,
  id: string,
): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

export interface UpdateUserFields {
  timezone?: string;
  theme?: string;
}

export async function updateUser(
  db: Database,
  id: string,
  fields: UpdateUserFields,
): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return user;
}
