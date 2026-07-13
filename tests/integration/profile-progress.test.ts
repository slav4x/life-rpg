import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { exportUserData } from "@/application/profile/export";
import { getProfileData } from "@/application/profile/get-profile";
import { updateUserProfile } from "@/application/profile/update-profile";
import { getProgressData } from "@/application/progress/get-progress";
import { completeTask } from "@/application/tasks/complete-task";
import { ensureAttributes, listAttributes } from "@/db/repositories/attributes";
import { createSkill } from "@/db/repositories/skills";
import { createTask } from "@/db/repositories/tasks";
import * as schema from "@/db/schema";
import { users } from "@/db/schema";

const url = process.env.TEST_DATABASE_URL;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(
  new Date(),
);

describe.skipIf(!url)("progress, profile & export (integration)", () => {
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
      .values({ telegramId: 740_000_001n, firstName: "Stat" })
      .returning();
    userId = user.id;
    const attrs = await listAttributes(db);
    const skill = await createSkill(db, {
      userId,
      attributeId: attrs.find((a) => a.code === "mind")!.id,
      name: "Frontend",
    });
    skillId = skill.id;
  });

  async function completeOne(baseXp = 50) {
    const task = await createTask(db, {
      userId,
      skillId,
      title: "Задача",
      localDate: today,
      baseXp,
      difficulty: "normal",
    });
    await completeTask({ userId, taskId: task.id, idempotencyKey: task.id }, db);
  }

  it("aggregates progress for the last 7 days", async () => {
    await completeOne(50);

    const data = await getProgressData(userId, "7d", "UTC", db);

    expect(data.totalXp).toBe(50);
    expect(data.completedTasks).toBe(1);
    expect(data.daily).toHaveLength(7);
    expect(data.daily.at(-1)).toEqual({ date: today, xp: 50 });
    expect(data.attributes.find((a) => a.code === "mind")?.xp).toBe(13);
  });

  it("returns the profile with all attributes and achievements", async () => {
    const data = await getProfileData(userId, db);

    expect(data.attributes).toHaveLength(6);
    expect(data.achievements).toHaveLength(8);
  });

  it("exports serialisable user data without bigint", async () => {
    await completeOne(50);

    const exported = await exportUserData(userId, db);
    const json = JSON.stringify(exported);
    const parsed = JSON.parse(json);

    expect(parsed.user.telegramId).toBe("740000001");
    expect(parsed.tasks.length).toBeGreaterThanOrEqual(1);
    expect(parsed.xpTransactions.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects an invalid timezone", async () => {
    await expect(
      updateUserProfile(userId, { timezone: "Mars/Base" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });
});
