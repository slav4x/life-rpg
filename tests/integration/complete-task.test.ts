import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { completeTask } from "@/application/tasks/complete-task";
import { ensureAttributes, listAttributes } from "@/db/repositories/attributes";
import { createSkill } from "@/db/repositories/skills";
import { createTask } from "@/db/repositories/tasks";
import {
  getUserAttributeXp,
  getUserSkillXp,
  sumGlobalXp,
} from "@/db/repositories/xp";
import * as schema from "@/db/schema";
import { users } from "@/db/schema";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("completeTask (integration)", () => {
  let client: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;

  let userId: string;
  let bodySkillId: string;
  let bodyAttributeId: string;

  beforeAll(async () => {
    client = postgres(url!, { max: 1, onnotice: () => {} });
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    await ensureAttributes(db);
  });

  afterAll(async () => {
    await client?.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await db.execute(
      sql`truncate table xp_transactions, task_completions, tasks, user_skills, user_attributes, skills, sessions, users restart identity cascade`,
    );
    const [user] = await db
      .insert(users)
      .values({ telegramId: 700_000_001n, firstName: "Player" })
      .returning();
    userId = user.id;

    const attrs = await listAttributes(db);
    bodyAttributeId = attrs.find((a) => a.code === "body")!.id;
    const skill = await createSkill(db, {
      userId,
      attributeId: bodyAttributeId,
      name: "Кардио",
    });
    bodySkillId = skill.id;
  });

  async function newTask(baseXp: number, difficulty = "normal") {
    return createTask(db, {
      userId,
      skillId: bodySkillId,
      title: "Пробежка",
      localDate: "2026-07-13",
      baseXp,
      difficulty,
    });
  }

  it("accrues XP to global, skill and attribute and updates caches", async () => {
    const task = await newTask(50);

    const result = await completeTask(
      { userId, taskId: task.id, idempotencyKey: "k1" },
      db,
    );

    expect(result.xp).toEqual({
      global: 50,
      skill: 50,
      attribute: 13,
      multiplier: 1,
    });
    expect(await sumGlobalXp(db, userId)).toBe(50);
    expect(await getUserSkillXp(db, userId, bodySkillId)).toBe(50);
    expect(await getUserAttributeXp(db, userId, bodyAttributeId)).toBe(13);

    const rows = await db.select().from(schema.xpTransactions);
    expect(rows).toHaveLength(3);
  });

  it("is idempotent — a repeat does not double-accrue", async () => {
    const task = await newTask(50);
    await completeTask({ userId, taskId: task.id, idempotencyKey: "k1" }, db);

    const again = await completeTask(
      { userId, taskId: task.id, idempotencyKey: "k2" },
      db,
    );

    expect(again.alreadyCompleted).toBe(true);
    expect(await sumGlobalXp(db, userId)).toBe(50);
    expect(await db.select().from(schema.taskCompletions)).toHaveLength(1);
  });

  it("reports a global level-up when crossing a threshold", async () => {
    const firstTask = await newTask(250);
    await completeTask(
      { userId, taskId: firstTask.id, idempotencyKey: "before-level-up" },
      db,
    );
    const task = await newTask(150);

    const result = await completeTask(
      { userId, taskId: task.id, idempotencyKey: "k1" },
      db,
    );

    // 250 + 150 XP -> level 2.
    expect(result.levelUp).toEqual({ from: 1, to: 2 });
  });

  it("applies the difficulty multiplier", async () => {
    const task = await newTask(50, "hard");

    const result = await completeTask(
      { userId, taskId: task.id, idempotencyKey: "k1" },
      db,
    );

    // 50 * 1.3 = 65; attribute = round(65 * 0.25) = 16.
    expect(result.xp.global).toBe(65);
    expect(result.xp.attribute).toBe(16);
  });
});
