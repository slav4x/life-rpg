import { eq, inArray } from "drizzle-orm";

import { getDb, type DbClient } from "@/db/client";
import * as schema from "@/db/schema";

/**
 * Gather all of a user's data for the JSON export (SPEC §6.7). Sessions are
 * excluded (they hold token hashes); the Telegram id is serialised as a string.
 */
export async function exportUserData(
  userId: string,
  db: DbClient = getDb(),
): Promise<Record<string, unknown>> {
  const [
    users,
    skills,
    userSkills,
    userAttributes,
    templates,
    tasks,
    completions,
    xpTransactions,
    quests,
    streaks,
    userAchievements,
    attributes,
    achievementCatalog,
  ] = await Promise.all([
    db.select().from(schema.users).where(eq(schema.users.id, userId)),
    db.select().from(schema.skills).where(eq(schema.skills.userId, userId)),
    db.select().from(schema.userSkills).where(eq(schema.userSkills.userId, userId)),
    db
      .select()
      .from(schema.userAttributes)
      .where(eq(schema.userAttributes.userId, userId)),
    db
      .select()
      .from(schema.taskTemplates)
      .where(eq(schema.taskTemplates.userId, userId)),
    db.select().from(schema.tasks).where(eq(schema.tasks.userId, userId)),
    db
      .select()
      .from(schema.taskCompletions)
      .where(eq(schema.taskCompletions.userId, userId)),
    db
      .select()
      .from(schema.xpTransactions)
      .where(eq(schema.xpTransactions.userId, userId)),
    db.select().from(schema.quests).where(eq(schema.quests.userId, userId)),
    db.select().from(schema.streaks).where(eq(schema.streaks.userId, userId)),
    db
      .select()
      .from(schema.userAchievements)
      .where(eq(schema.userAchievements.userId, userId)),
    db.select().from(schema.attributes),
    db.select().from(schema.achievements),
  ]);

  const questIds = quests.map((q) => q.id);
  const questSteps =
    questIds.length > 0
      ? await db
          .select()
          .from(schema.questSteps)
          .where(inArray(schema.questSteps.questId, questIds))
      : [];

  const user = users[0]
    ? { ...users[0], telegramId: users[0].telegramId.toString() }
    : null;

  return {
    format: "life-rpg-export",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    user,
    attributes: attributes.map((attribute) => ({
      id: attribute.id,
      code: attribute.code,
    })),
    achievementCatalog: achievementCatalog.map((achievement) => ({
      id: achievement.id,
      code: achievement.code,
    })),
    skills,
    userSkills,
    userAttributes,
    taskTemplates: templates,
    tasks,
    taskCompletions: completions,
    xpTransactions,
    quests,
    questSteps,
    streaks,
    userAchievements,
  };
}
