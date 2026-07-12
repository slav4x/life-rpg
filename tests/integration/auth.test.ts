import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  authenticateWithTelegram,
  type AuthDeps,
} from "@/application/auth/authenticate";
import {
  deleteSessionByTokenHash,
  findActiveSessionByTokenHash,
} from "@/db/repositories/sessions";
import * as schema from "@/db/schema";
import { hashSessionToken } from "@/lib/auth/tokens";
import { createInitData, TEST_BOT_TOKEN } from "../fixtures/telegram";

const url = process.env.TEST_DATABASE_URL;

// Runs only when a throwaway PostgreSQL is provided (SPEC §18).
describe.skipIf(!url)("authenticateWithTelegram (integration)", () => {
  let client: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;

  const OWNER_ID = 555_000_111;

  const deps = (): AuthDeps => ({
    db,
    botToken: TEST_BOT_TOKEN,
    allowedTelegramIds: [BigInt(OWNER_ID)],
    maxAgeSeconds: 86_400,
    sessionTtlDays: 30,
    now: () => new Date(),
  });

  beforeAll(async () => {
    client = postgres(url!, { max: 1, onnotice: () => {} });
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    await db.execute(
      sql`truncate table sessions, users restart identity cascade`,
    );
  });

  afterAll(async () => {
    await client?.end({ timeout: 5 });
  });

  it("creates a user and session for an allowlisted owner", async () => {
    const initData = createInitData({
      user: { id: OWNER_ID, first_name: "Owner" },
    });

    const result = await authenticateWithTelegram(initData, deps());

    expect(result.user.telegramId).toBe(BigInt(OWNER_ID));
    const found = await findActiveSessionByTokenHash(
      db,
      hashSessionToken(result.token),
    );
    expect(found?.user.id).toBe(result.user.id);
  });

  it("refreshes the profile without duplicating the user", async () => {
    const initData = createInitData({
      user: { id: OWNER_ID, first_name: "Owner Updated" },
    });

    const result = await authenticateWithTelegram(initData, deps());

    const allUsers = await db.select().from(schema.users);
    expect(allUsers).toHaveLength(1);
    expect(result.user.firstName).toBe("Owner Updated");
  });

  it("rejects a non-allowlisted Telegram user with 403", async () => {
    const initData = createInitData({
      user: { id: 424_242, first_name: "Stranger" },
    });

    await expect(
      authenticateWithTelegram(initData, deps()),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("revokes a session on logout", async () => {
    const initData = createInitData({
      user: { id: OWNER_ID, first_name: "Owner" },
    });
    const result = await authenticateWithTelegram(initData, deps());
    const tokenHash = hashSessionToken(result.token);

    await deleteSessionByTokenHash(db, tokenHash);

    expect(await findActiveSessionByTokenHash(db, tokenHash)).toBeUndefined();
  });
});
