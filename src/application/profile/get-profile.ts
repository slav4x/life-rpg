import { getDb, type DbClient } from "@/db/client";
import {
  listAchievements,
  listUserAchievements,
} from "@/db/repositories/achievements";
import { attributeDistribution } from "@/db/repositories/progress";
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
}

export interface ProfileTemplate {
  id: string;
  title: string;
  recurrenceType: string;
  weekdays: number[] | null;
  isActive: boolean;
}

export interface ProfileData {
  totalXp: number;
  level: LevelProgress;
  attributes: ProfileAttribute[];
  achievements: ProfileAchievement[];
  templates: ProfileTemplate[];
}

/** Everything the profile screen shows (SPEC §6.7). */
export async function getProfileData(
  userId: string,
  db: DbClient = getDb(),
): Promise<ProfileData> {
  const [totalXp, attributes, allAchievements, userAchievements, templates] =
    await Promise.all([
      sumGlobalXp(db, userId),
      attributeDistribution(db, userId),
      listAchievements(db),
      listUserAchievements(db, userId),
      listTemplates(db, userId),
    ]);

  const unlockedIds = new Set(userAchievements.map((u) => u.achievementId));

  return {
    totalXp,
    level: levelProgress(totalXp),
    attributes: attributes.map((a) => ({ ...a, level: calculateLevel(a.xp) })),
    achievements: allAchievements.map((a) => ({
      code: a.code,
      name: a.name,
      description: a.description,
      icon: a.icon,
      unlocked: unlockedIds.has(a.id),
    })),
    templates: templates.map((t) => ({
      id: t.id,
      title: t.title,
      recurrenceType: t.recurrenceType,
      weekdays: t.weekdays,
      isActive: t.isActive && t.archivedAt === null,
    })),
  };
}
