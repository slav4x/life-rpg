import { and, asc, eq, isNull } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { taskTemplates, type TaskTemplate } from "@/db/schema";

export interface CreateTemplateInput {
  userId: string;
  skillId: string;
  title: string;
  description?: string | null;
  baseXp: number;
  difficulty: string;
  recurrenceType: string;
  weekdays?: number[] | null;
}

export async function createTemplate(
  db: DbClient,
  input: CreateTemplateInput,
): Promise<TaskTemplate> {
  const [template] = await db
    .insert(taskTemplates)
    .values({
      userId: input.userId,
      skillId: input.skillId,
      title: input.title,
      description: input.description ?? null,
      baseXp: input.baseXp,
      difficulty: input.difficulty,
      recurrenceType: input.recurrenceType,
      weekdays: input.weekdays ?? null,
    })
    .returning();
  return template;
}

/** Active (non-archived) templates for lazy daily materialisation (SPEC §12). */
export async function listActiveTemplates(
  db: DbClient,
  userId: string,
): Promise<TaskTemplate[]> {
  return db
    .select()
    .from(taskTemplates)
    .where(
      and(
        eq(taskTemplates.userId, userId),
        eq(taskTemplates.isActive, true),
        isNull(taskTemplates.archivedAt),
      ),
    )
    .orderBy(asc(taskTemplates.createdAt));
}

export async function listTemplates(
  db: DbClient,
  userId: string,
): Promise<TaskTemplate[]> {
  return db
    .select()
    .from(taskTemplates)
    .where(eq(taskTemplates.userId, userId))
    .orderBy(asc(taskTemplates.createdAt));
}

export async function getTemplateById(
  db: DbClient,
  userId: string,
  id: string,
): Promise<TaskTemplate | undefined> {
  const [template] = await db
    .select()
    .from(taskTemplates)
    .where(and(eq(taskTemplates.id, id), eq(taskTemplates.userId, userId)))
    .limit(1);
  return template;
}

export interface UpdateTemplateFields {
  title?: string;
  description?: string | null;
  baseXp?: number;
  difficulty?: string;
  recurrenceType?: string;
  weekdays?: number[] | null;
  isActive?: boolean;
}

export async function updateTemplate(
  db: DbClient,
  userId: string,
  id: string,
  fields: UpdateTemplateFields,
): Promise<TaskTemplate | undefined> {
  const [template] = await db
    .update(taskTemplates)
    .set({ ...fields, updatedAt: new Date() })
    .where(and(eq(taskTemplates.id, id), eq(taskTemplates.userId, userId)))
    .returning();
  return template;
}

/** Archive every active template that uses a skill (skill archive cascade). */
export async function archiveTemplatesBySkill(
  db: DbClient,
  userId: string,
  skillId: string,
): Promise<void> {
  const now = new Date();
  await db
    .update(taskTemplates)
    .set({ isActive: false, archivedAt: now, updatedAt: now })
    .where(
      and(
        eq(taskTemplates.userId, userId),
        eq(taskTemplates.skillId, skillId),
        isNull(taskTemplates.archivedAt),
      ),
    );
}

/** Logical archive — history is preserved (SPEC §13). */
export async function archiveTemplate(
  db: DbClient,
  userId: string,
  id: string,
): Promise<TaskTemplate | undefined> {
  const now = new Date();
  const [template] = await db
    .update(taskTemplates)
    .set({ isActive: false, archivedAt: now, updatedAt: now })
    .where(and(eq(taskTemplates.id, id), eq(taskTemplates.userId, userId)))
    .returning();
  return template;
}
