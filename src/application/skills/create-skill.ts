import { GameError } from "@/application/game/errors";
import { getDb } from "@/db/client";
import { listAttributes } from "@/db/repositories/attributes";
import { createSkill } from "@/db/repositories/skills";
import type { Skill } from "@/db/schema";

export interface CreateSkillCommand {
  userId: string;
  name: string;
  attributeCode: string;
  description?: string;
}

export async function createUserSkill(cmd: CreateSkillCommand): Promise<Skill> {
  const db = getDb();
  const attribute = (await listAttributes(db)).find(
    (a) => a.code === cmd.attributeCode,
  );
  if (!attribute) {
    throw new GameError("attribute_not_found", "Unknown attribute");
  }

  return createSkill(db, {
    userId: cmd.userId,
    attributeId: attribute.id,
    name: cmd.name,
    description: cmd.description ?? null,
  });
}
