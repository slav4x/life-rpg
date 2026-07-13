import { eq, sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  archiveUserSkill,
  updateUserSkill,
} from "@/application/skills/manage-skill";
import { createUserSkill } from "@/application/skills/create-skill";
import { updateUserTemplate } from "@/application/templates/manage-template";
import { completeTask } from "@/application/tasks/complete-task";
import { revertTask } from "@/application/tasks/revert-task";
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

  it("changes attribute and visuals before the first XP accrual", async () => {
    const bodyId = (await listAttributes(db)).find((a) => a.code === "body")!.id;

    const updated = await updateUserSkill(
      userId,
      skillId,
      {
        name: "React",
        attributeCode: "body",
        icon: "🧠",
        color: "#0EA5E9",
      },
      db,
    );

    expect(updated).toMatchObject({
      name: "React",
      attributeId: bodyId,
      icon: "🧠",
      color: "#0EA5E9",
    });
  });

  it("renames a skill but forbids changing its attribute after XP history", async () => {
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

    await revertTask({ userId, taskId: task.id }, db);
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

    await expect(
      updateUserTemplate(userId, template.id, { isActive: true }, db),
    ).rejects.toMatchObject({ code: "skill_archived" });

    await updateUserSkill(userId, skillId, { status: "active" }, db);
    const restoredTemplate = await updateUserTemplate(
      userId,
      template.id,
      { isActive: true },
      db,
    );
    expect(restoredTemplate.archivedAt).toBeNull();
    expect(restoredTemplate.isActive).toBe(true);
  });

  it("rejects a duplicate active skill name but allows reuse after archive", async () => {
    await expect(
      createUserSkill(
        {
          userId,
          name: " frontend ",
          attributeCode: "mind",
        },
        db,
      ),
    ).rejects.toMatchObject({ code: "duplicate_skill", status: 409 });

    await archiveUserSkill(userId, skillId, db);
    await expect(
      updateUserSkill(userId, skillId, { name: "Backend" }, db),
    ).rejects.toMatchObject({ code: "skill_archived" });
    const replacement = await createUserSkill(
      { userId, name: "FRONTEND", attributeCode: "mind" },
      db,
    );
    expect(replacement.status).toBe("active");

    await expect(
      updateUserSkill(userId, skillId, { status: "active" }, db),
    ).rejects.toMatchObject({ code: "duplicate_skill", status: 409 });

    const restored = await updateUserSkill(
      userId,
      skillId,
      { status: "active", name: "Backend" },
      db,
    );
    expect(restored.status).toBe("active");
    expect(restored.archivedAt).toBeNull();
    expect(restored.name).toBe("Backend");
  });
});
