import { getDb } from "@/db/client";
import { listAttributes } from "@/db/repositories/attributes";
import { listActiveSkillsWithXp } from "@/db/repositories/skills";
import { levelProgress, type LevelProgress } from "@/domain/game/calculate-level";

export interface SkillOverviewItem {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  xp: number;
  level: LevelProgress;
}

export interface AttributeGroup {
  code: string;
  name: string;
  skills: SkillOverviewItem[];
}

/** Active skills grouped by attribute, with level and progress (SPEC §6.5). */
export async function getSkillsOverview(
  userId: string,
): Promise<AttributeGroup[]> {
  const db = getDb();
  const [attrs, skills] = await Promise.all([
    listAttributes(db),
    listActiveSkillsWithXp(db, userId),
  ]);

  const byAttribute = new Map<string, SkillOverviewItem[]>();
  for (const { skill, xp } of skills) {
    const list = byAttribute.get(skill.attributeId) ?? [];
    list.push({
      id: skill.id,
      name: skill.name,
      icon: skill.icon,
      color: skill.color,
      xp,
      level: levelProgress(xp),
    });
    byAttribute.set(skill.attributeId, list);
  }

  return attrs
    .map((a) => ({ code: a.code, name: a.name, skills: byAttribute.get(a.id) ?? [] }))
    .filter((group) => group.skills.length > 0);
}
