import { getDb, type DbClient } from "@/db/client";
import {
  listAchievements,
  listUserAchievements,
} from "@/db/repositories/achievements";
import { attributeDistribution } from "@/db/repositories/progress";
import { listActiveSkills } from "@/db/repositories/skills";
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
  description: string | null;
  recurrenceType: string;
  weekdays: number[] | null;
  estimatedMinutes: number | null;
  isActive: boolean;
  archived: boolean;
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
  const [totalXp, attributes, allAchievements, userAchievements, templates, skills] =
    await Promise.all([
      sumGlobalXp(db, userId),
      attributeDistribution(db, userId),
      listAchievements(db),
      listUserAchievements(db, userId),
      listTemplates(db, userId),
      listActiveSkills(db, userId),
    ]);

  const unlockedById = new Map(
    userAchievements.map((item) => [item.achievementId, item.unlockedAt]),
  );

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
    templates: templates.map((t) => ({
      id: t.id,
      title: t.title,
      skillId: t.skillId,
      baseXp: t.baseXp,
      difficulty: t.difficulty,
      description: t.description,
      recurrenceType: t.recurrenceType,
      weekdays: t.weekdays,
      estimatedMinutes: t.estimatedMinutes,
      isActive: t.isActive,
      archived: t.archivedAt !== null,
    })),
    skills: skills.map((s) => ({ id: s.id, name: s.name })),
  };
}
