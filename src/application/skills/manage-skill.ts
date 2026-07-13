import { GameError } from "@/application/game/errors";
import { getDb, type DbClient } from "@/db/client";
import { isUniqueConstraintViolation } from "@/db/errors";
import { listAttributes } from "@/db/repositories/attributes";
import {
  archiveSkill,
  getSkillById,
  restoreSkill,
  updateSkill,
  type UpdateSkillFields,
} from "@/db/repositories/skills";
import { archiveTemplatesBySkill } from "@/db/repositories/task-templates";
import { hasSkillXpHistory } from "@/db/repositories/xp";
import type { Skill } from "@/db/schema";

export interface UpdateSkillCommand {
  name?: string;
  description?: string | null;
  attributeCode?: string;
  icon?: string | null;
  color?: string | null;
  status?: "active";
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
    icon: cmd.icon,
    color: cmd.color,
  };

  const current = await getSkillById(db, userId, id);
  if (!current) throw new GameError("skill_not_found", "Skill not found");

  if (cmd.attributeCode) {
    const attribute = (await listAttributes(db)).find(
      (a) => a.code === cmd.attributeCode,
    );
    if (!attribute) {
      throw new GameError("attribute_not_found", "Unknown attribute");
    }
    if (attribute.id !== current.attributeId) {
      // Moving a skill after its first accrual would make its immutable XP
      // history disagree with the new attribute, even if that accrual was reverted.
      if (await hasSkillXpHistory(db, userId, id)) {
        throw new GameError(
          "invalid_input",
          "Cannot change the attribute of a skill with XP history",
        );
      }
      fields.attributeId = attribute.id;
    }
  }

  let skill: Skill | undefined;
  try {
    if (current.status === "archived") {
      if (cmd.status !== "active") {
        throw new GameError("skill_archived", "Restore skill before editing");
      }
      skill = await restoreSkill(db, userId, id, fields);
    } else {
      skill = await updateSkill(db, userId, id, fields);
    }
  } catch (error) {
    if (isUniqueConstraintViolation(error, "skills_user_active_name_unique")) {
      throw new GameError("duplicate_skill", "Active skill name already exists");
    }
    throw error;
  }
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
