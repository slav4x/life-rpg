import { GameError } from "@/application/game/errors";
import { getDb } from "@/db/client";
import { listAttributes } from "@/db/repositories/attributes";
import {
  archiveSkill,
  updateSkill,
  type UpdateSkillFields,
} from "@/db/repositories/skills";
import type { Skill } from "@/db/schema";

export interface UpdateSkillCommand {
  name?: string;
  description?: string | null;
  attributeCode?: string;
}

export async function updateUserSkill(
  userId: string,
  id: string,
  cmd: UpdateSkillCommand,
): Promise<Skill> {
  const db = getDb();
  const fields: UpdateSkillFields = {
    name: cmd.name,
    description: cmd.description,
  };

  if (cmd.attributeCode) {
    const attribute = (await listAttributes(db)).find(
      (a) => a.code === cmd.attributeCode,
    );
    if (!attribute) {
      throw new GameError("attribute_not_found", "Unknown attribute");
    }
    fields.attributeId = attribute.id;
  }

  const skill = await updateSkill(db, userId, id, fields);
  if (!skill) throw new GameError("skill_not_found", "Skill not found");
  return skill;
}

export async function archiveUserSkill(
  userId: string,
  id: string,
): Promise<Skill> {
  const skill = await archiveSkill(getDb(), userId, id);
  if (!skill) throw new GameError("skill_not_found", "Skill not found");
  return skill;
}
