import { getDb, type DbClient } from "@/db/client";
import {
  listAchievements,
  listUserAchievements,
} from "@/db/repositories/achievements";
import { attributeDistribution } from "@/db/repositories/progress";
import { listSkills } from "@/db/repositories/skills";
import { listTemplates } from "@/db/repositories/task-templates";
import { sumGlobalXp } from "@/db/repositories/xp";
import {
  calculateLevel,
  levelProgress,
  type LevelProgress,
} from "@/domain/game/calculate-level";

export interface ProfileAttribute {
  code: string;
  name: string;
  xp: number;
  level: number;
}

export interface ProfileAchievement {
  code: string;
  name: string;
  description: string;
  icon: string | null;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface ProfileTemplate {
  id: string;
  title: string;
  skillId: string;
  baseXp: number;
  difficulty: string;
  priority: string;
  description: string | null;
  recurrenceType: string;
  weekdays: number[] | null;
  estimatedMinutes: number | null;
  startsOn: string;
  endsOn: string | null;
  isActive: boolean;
  archived: boolean;
  skillName: string;
  skillArchived: boolean;
}

export interface ProfileSkillOption {
  id: string;
  name: string;
}

export interface ProfileData {
  totalXp: number;
  level: LevelProgress;
  attributes: ProfileAttribute[];
  achievements: ProfileAchievement[];
  templates: ProfileTemplate[];
  skills: ProfileSkillOption[];
}

/** Everything the profile screen shows (SPEC §6.7). */
export async function getProfileData(
  userId: string,
  db: DbClient = getDb(),
): Promise<ProfileData> {
  const [totalXp, attributes, allAchievements, userAchievements, templates, allSkills] =
    await Promise.all([
      sumGlobalXp(db, userId),
      attributeDistribution(db, userId),
      listAchievements(db),
      listUserAchievements(db, userId),
      listTemplates(db, userId),
      listSkills(db, userId),
    ]);

  const unlockedById = new Map(
    userAchievements.map((item) => [item.achievementId, item.unlockedAt]),
  );
  const skillsById = new Map(allSkills.map((skill) => [skill.id, skill]));

  return {
    totalXp,
    level: levelProgress(totalXp),
    attributes: attributes.map((a) => ({ ...a, level: calculateLevel(a.xp) })),
    achievements: allAchievements.map((a) => ({
      code: a.code,
      name: a.name,
      description: a.description,
      icon: a.icon,
      unlocked: unlockedById.has(a.id),
      unlockedAt: unlockedById.get(a.id)?.toISOString() ?? null,
    })),
    templates: templates.map((template) => {
      const skill = skillsById.get(template.skillId);
      return {
        id: template.id,
        title: template.title,
        skillId: template.skillId,
        baseXp: template.baseXp,
        difficulty: template.difficulty,
        priority: template.priority,
        description: template.description,
        recurrenceType: template.recurrenceType,
        weekdays: template.weekdays,
        estimatedMinutes: template.estimatedMinutes,
        startsOn: template.startsOn,
        endsOn: template.endsOn,
        isActive: template.isActive,
        archived: template.archivedAt !== null,
        skillName: skill?.name ?? "Удалённый навык",
        skillArchived: skill?.status !== "active",
      };
    }),
    skills: allSkills
      .filter((skill) => skill.status === "active")
      .map((skill) => ({ id: skill.id, name: skill.name })),
  };
}
