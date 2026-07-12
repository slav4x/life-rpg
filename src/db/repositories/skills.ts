import { and, asc, eq } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { skills, type Skill } from "@/db/schema";

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
