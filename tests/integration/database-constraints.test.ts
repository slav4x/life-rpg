import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ensureAttributes, listAttributes } from "@/db/repositories/attributes";
import { createSkill } from "@/db/repositories/skills";
import * as schema from "@/db/schema";
import { quests, tasks, userSkills, users, xpTransactions } from "@/db/schema";

const url = process.env.TEST_DATABASE_URL;

function isCheckViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current instanceof Error; depth += 1) {
    if ((current as Error & { code?: string }).code === "23514") return true;
    current = (current as Error & { cause?: unknown }).cause;
  }
  return false;
}

describe.skipIf(!url)("database domain constraints (integration)", () => {
  let client: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;
  let userId: string;
  let skillId: string;

  beforeAll(async () => {
    client = postgres(url!, { max: 5, onnotice: () => {} });
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    await ensureAttributes(db);
  });

  afterAll(async () => {
    await client?.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await db.execute(
      sql`truncate table xp_transactions, task_completions, streaks, tasks, task_templates, quest_steps, quests, user_achievements, user_skills, user_attributes, skills, sessions, users restart identity cascade`,
    );
    const [user] = await db
      .insert(users)
      .values({ telegramId: 790_000_001n, firstName: "Constraints" })
      .returning();
    userId = user.id;
    skillId = (
      await createSkill(db, {
        userId,
        attributeId: (await listAttributes(db))[0].id,
        name: "Проверка",
      })
    ).id;
  });

  it("rejects invalid statuses, types and difficulty", async () => {
    await expect(
      db.insert(tasks).values({
        userId,
        skillId,
        title: "Некорректная задача",
        localDate: "2026-07-13",
        baseXp: 20,
        difficulty: "impossible",
        status: "unknown",
      }),
    ).rejects.toSatisfy(isCheckViolation);

    await expect(
      db.insert(quests).values({
        userId,
        title: "Некорректный квест",
        type: "endless",
        status: "unknown",
      }),
    ).rejects.toSatisfy(isCheckViolation);
  });

  it("rejects XP values that violate journal and cache invariants", async () => {
    await expect(
      db.insert(userSkills).values({ userId, skillId, xp: -1 }),
    ).rejects.toSatisfy(isCheckViolation);

    await expect(
      db.insert(xpTransactions).values({
        userId,
        amount: 0,
        scope: "global",
        sourceType: "manual_adjustment",
        sourceId: crypto.randomUUID(),
        baseXp: 0,
        multiplier: "1",
      }),
    ).rejects.toSatisfy(isCheckViolation);
  });
});
