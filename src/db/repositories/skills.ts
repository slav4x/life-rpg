import { and, asc, eq } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { skills, userSkills, type Skill } from "@/db/schema";

export interface CreateSkillInput {
  userId: string;
  attributeId: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
}

export async function createSkill(
  db: DbClient,
  input: CreateSkillInput,
): Promise<Skill> {
  const [skill] = await db
    .insert(skills)
    .values({
      userId: input.userId,
      attributeId: input.attributeId,
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
    })
    .returning();
  return skill;
}

export async function createSkills(
  db: DbClient,
  rows: CreateSkillInput[],
): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(skills).values(
    rows.map((r) => ({
      userId: r.userId,
      attributeId: r.attributeId,
      name: r.name,
    })),
  );
}

export async function listActiveSkills(
  db: DbClient,
  userId: string,
): Promise<Skill[]> {
  return db
    .select()
    .from(skills)
    .where(and(eq(skills.userId, userId), eq(skills.status, "active")))
    .orderBy(asc(skills.name));
}

export async function listSkills(
  db: DbClient,
  userId: string,
): Promise<Skill[]> {
  return db
    .select()
    .from(skills)
    .where(eq(skills.userId, userId))
    .orderBy(asc(skills.name));
}

export async function countSkills(
  db: DbClient,
  userId: string,
): Promise<number> {
  const rows = await db
    .select({ id: skills.id })
    .from(skills)
    .where(eq(skills.userId, userId));
  return rows.length;
}

export async function getSkillById(
  db: DbClient,
  userId: string,
  skillId: string,
): Promise<Skill | undefined> {
  const [skill] = await db
    .select()
    .from(skills)
    .where(and(eq(skills.id, skillId), eq(skills.userId, userId)))
    .limit(1);
  return skill;
}

export interface SkillWithXp {
  skill: Skill;
  xp: number;
}

/** Active skills with their cached XP (0 when not started). */
export async function listActiveSkillsWithXp(
  db: DbClient,
  userId: string,
): Promise<SkillWithXp[]> {
  const rows = await db
    .select({ skill: skills, xp: userSkills.xp })
    .from(skills)
    .leftJoin(
      userSkills,
      and(eq(userSkills.skillId, skills.id), eq(userSkills.userId, userId)),
    )
    .where(and(eq(skills.userId, userId), eq(skills.status, "active")))
    .orderBy(asc(skills.name));
  return rows.map((r) => ({ skill: r.skill, xp: r.xp ?? 0 }));
}

/** Archived skills with their cached XP, used by the restore UI. */
export async function listArchivedSkillsWithXp(
  db: DbClient,
  userId: string,
): Promise<SkillWithXp[]> {
  const rows = await db
    .select({ skill: skills, xp: userSkills.xp })
    .from(skills)
    .leftJoin(
      userSkills,
      and(eq(userSkills.skillId, skills.id), eq(userSkills.userId, userId)),
    )
    .where(and(eq(skills.userId, userId), eq(skills.status, "archived")))
    .orderBy(asc(skills.name));
  return rows.map((row) => ({ skill: row.skill, xp: row.xp ?? 0 }));
}

export interface UpdateSkillFields {
  name?: string;
  description?: string | null;
  attributeId?: string;
  icon?: string | null;
  color?: string | null;
}

export async function updateSkill(
  db: DbClient,
  userId: string,
  id: string,
  fields: UpdateSkillFields,
): Promise<Skill | undefined> {
  const [skill] = await db
    .update(skills)
    .set({ ...fields, updatedAt: new Date() })
    .where(and(eq(skills.id, id), eq(skills.userId, userId)))
    .returning();
  return skill;
}

/** Logical archive — keeps history (SPEC §13). */
export async function archiveSkill(
  db: DbClient,
  userId: string,
  id: string,
): Promise<Skill | undefined> {
  const now = new Date();
  const [skill] = await db
    .update(skills)
    .set({ status: "archived", archivedAt: now, updatedAt: now })
    .where(and(eq(skills.id, id), eq(skills.userId, userId)))
    .returning();
  return skill;
}

export async function restoreSkill(
  db: DbClient,
  userId: string,
  id: string,
  fields: UpdateSkillFields = {},
): Promise<Skill | undefined> {
  const now = new Date();
  const [skill] = await db
    .update(skills)
    .set({
      ...fields,
      status: "active",
      archivedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(skills.id, id),
        eq(skills.userId, userId),
        eq(skills.status, "archived"),
      ),
    )
    .returning();
  return skill;
}
