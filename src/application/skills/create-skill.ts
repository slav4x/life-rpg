import { GameError } from "@/application/game/errors";
import { getDb, type DbClient } from "@/db/client";
import { isUniqueConstraintViolation } from "@/db/errors";
import { listAttributes } from "@/db/repositories/attributes";
import { createSkill } from "@/db/repositories/skills";
import type { Skill } from "@/db/schema";

export interface CreateSkillCommand {
  userId: string;
  name: string;
  attributeCode: string;
  description?: string;
  icon?: string;
  color?: string;
}

export async function createUserSkill(
  cmd: CreateSkillCommand,
  db: DbClient = getDb(),
): Promise<Skill> {
  const attribute = (await listAttributes(db)).find(
    (a) => a.code === cmd.attributeCode,
  );
  if (!attribute) {
    throw new GameError("attribute_not_found", "Unknown attribute");
  }

  try {
    return await createSkill(db, {
      userId: cmd.userId,
      attributeId: attribute.id,
      name: cmd.name,
      description: cmd.description ?? null,
      icon: cmd.icon ?? null,
      color: cmd.color ?? null,
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error, "skills_user_active_name_unique")) {
      throw new GameError("duplicate_skill", "Active skill name already exists");
    }
    throw error;
  }
}
