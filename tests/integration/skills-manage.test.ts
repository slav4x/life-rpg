import { eq, sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  archiveUserSkill,
  updateUserSkill,
} from "@/application/skills/manage-skill";
import { completeTask } from "@/application/tasks/complete-task";
import { ensureAttributes, listAttributes } from "@/db/repositories/attributes";
import { createSkill } from "@/db/repositories/skills";
import { createTemplate } from "@/db/repositories/task-templates";
import { createTask } from "@/db/repositories/tasks";
import * as schema from "@/db/schema";
import { skills, taskTemplates, users } from "@/db/schema";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("skill management (integration)", () => {
  let client: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;
  let userId: string;
  let skillId: string;
  let attributeId: string;

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
      .values({ telegramId: 750_000_001n, firstName: "S" })
      .returning();
    userId = user.id;
    attributeId = (await listAttributes(db)).find((a) => a.code === "mind")!.id;
    const skill = await createSkill(db, { userId, attributeId, name: "Frontend" });
    skillId = skill.id;
  });

  it("renames a skill but forbids changing its attribute after XP", async () => {
    const task = await createTask(db, {
      userId,
      skillId,
      title: "t",
      localDate: "2026-07-13",
      baseXp: 20,
      difficulty: "normal",
    });
    await completeTask({ userId, taskId: task.id, idempotencyKey: "a" }, db);

    // Rename is fine.
    const renamed = await updateUserSkill(userId, skillId, { name: "React" }, db);
    expect(renamed.name).toBe("React");

    // Changing the attribute after XP is rejected.
    await expect(
      updateUserSkill(userId, skillId, { attributeCode: "body" }, db),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("archives templates when the skill is archived", async () => {
    const template = await createTemplate(db, {
      userId,
      skillId,
      title: "Каждый день",
      baseXp: 20,
      difficulty: "normal",
      recurrenceType: "daily",
    });

    await archiveUserSkill(userId, skillId, db);

    const [s] = await db.select().from(skills).where(eq(skills.id, skillId));
    expect(s.status).toBe("archived");
    const [t] = await db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.id, template.id));
    expect(t.isActive).toBe(false);
    expect(t.archivedAt).not.toBeNull();
  });
});
