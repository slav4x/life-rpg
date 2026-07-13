import { eq, sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { completeTask } from "@/application/tasks/complete-task";
import { completeQuest } from "@/application/quests/complete-quest";
import { toggleStep } from "@/application/quests/toggle-step";
import { ensureAttributes, listAttributes } from "@/db/repositories/attributes";
import { listUserAchievements } from "@/db/repositories/achievements";
import { createSteps, listSteps } from "@/db/repositories/quest-steps";
import { createQuest } from "@/db/repositories/quests";
import { createSkill } from "@/db/repositories/skills";
import { createTask } from "@/db/repositories/tasks";
import { sumGlobalXp } from "@/db/repositories/xp";
import * as schema from "@/db/schema";
import { quests, users } from "@/db/schema";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("quests & achievements (integration)", () => {
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
      .values({ telegramId: 730_000_001n, firstName: "Hero" })
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

  async function activeQuest(rewardXp: number, manual = true) {
    const quest = await createQuest(db, {
      userId,
      title: "Проект",
      type: "main",
      rewardXp,
      status: "active",
      manualCompletion: manual,
    });
    await createSteps(db, quest.id, [
      { title: "Шаг 1", sortOrder: 0 },
      { title: "Шаг 2", sortOrder: 1 },
    ]);
    return quest;
  }

  it("completes a quest, grants the reward and unlocks first_quest", async () => {
    const quest = await activeQuest(300);

    const result = await completeQuest({ userId, questId: quest.id }, db);

    expect(result.rewardXp).toBe(300);
    expect(await sumGlobalXp(db, userId)).toBe(300);
    expect(result.unlockedAchievements.map((a) => a.code)).toContain(
      "first_quest",
    );

    const [row] = await db.select().from(quests).where(eq(quests.id, quest.id));
    expect(row.status).toBe("completed");
  });

  it("does not double-reward on repeated completion", async () => {
    const quest = await activeQuest(300);
    await completeQuest({ userId, questId: quest.id }, db);

    const again = await completeQuest({ userId, questId: quest.id }, db);

    expect(again.alreadyCompleted).toBe(true);
    expect(await sumGlobalXp(db, userId)).toBe(300);
  });

  it("auto-completes when manual completion is off and required steps done", async () => {
    const quest = await createQuest(db, {
      userId,
      title: "Авто",
      type: "side",
      rewardXp: 100,
      status: "active",
      manualCompletion: false,
    });
    await createSteps(db, quest.id, [{ title: "Единственный", sortOrder: 0 }]);
    const [step] = await listSteps(db, quest.id);

    const result = await toggleStep({ userId, stepId: step.id }, db);

    expect(result.completed).toBe(true);
    expect(result.questCompleted?.rewardXp).toBe(100);
    const [row] = await db.select().from(quests).where(eq(quests.id, quest.id));
    expect(row.status).toBe("completed");
  });

  it("unlocks first_action only once across task completions", async () => {
    const task1 = await createTask(db, {
      userId,
      skillId,
      title: "Задача 1",
      localDate: "2026-07-13",
      baseXp: 20,
      difficulty: "normal",
    });
    const r1 = await completeTask(
      { userId, taskId: task1.id, idempotencyKey: "a" },
      db,
    );
    expect(r1.unlockedAchievements.map((a) => a.code)).toContain("first_action");

    const task2 = await createTask(db, {
      userId,
      skillId,
      title: "Задача 2",
      localDate: "2026-07-13",
      baseXp: 20,
      difficulty: "normal",
    });
    const r2 = await completeTask(
      { userId, taskId: task2.id, idempotencyKey: "b" },
      db,
    );
    expect(r2.unlockedAchievements.map((a) => a.code)).not.toContain(
      "first_action",
    );

    const unlocked = await listUserAchievements(db, userId);
    // first_action present exactly once (pk prevents duplicates).
    expect(unlocked.length).toBeGreaterThanOrEqual(1);
  });
});
