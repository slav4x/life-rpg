import {
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { achievements } from "./achievements";
import { users } from "./users";

/** Unlocked achievements per user — granted once (SPEC §5.8, §10). */
export const userAchievements = pgTable(
  "user_achievements",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: uuid("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sourceId: uuid("source_id"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.achievementId] }),
  ],
);

export type UserAchievement = typeof userAchievements.$inferSelect;
