import { GameError } from "@/application/game/errors";
import { getDb, type DbClient } from "@/db/client";
import { listAttributes } from "@/db/repositories/attributes";
import {
  archiveSkill,
  updateSkill,
  type UpdateSkillFields,
} from "@/db/repositories/skills";
import { archiveTemplatesBySkill } from "@/db/repositories/task-templates";
import { getUserSkillXp } from "@/db/repositories/xp";
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
  db: DbClient = getDb(),
): Promise<Skill> {
  const fields: UpdateSkillFields = {
    name: cmd.name,
    description: cmd.description,
  };

  if (cmd.attributeCode) {
    // Changing the attribute after XP is earned would split history across two
    // attributes, so it is only allowed before the first accrual.
    if ((await getUserSkillXp(db, userId, id)) > 0) {
      throw new GameError(
        "invalid_input",
        "Cannot change the attribute of a skill with XP",
      );
    }
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

/** Archive a skill and cascade to its active templates so they stop producing tasks. */
export async function archiveUserSkill(
  userId: string,
  id: string,
  db: DbClient = getDb(),
): Promise<Skill> {
  const skill = await archiveSkill(db, userId, id);
  if (!skill) throw new GameError("skill_not_found", "Skill not found");
  await archiveTemplatesBySkill(db, userId, id);
  return skill;
}
