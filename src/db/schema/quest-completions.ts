import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { quests } from "./quests";
import { users } from "./users";

/** Immutable quest completion record; reversals preserve the original row. */
export const questCompletions = pgTable(
  "quest_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questId: uuid("quest_id")
      .notNull()
      .references(() => quests.id, { onDelete: "cascade" }),
    rewardXp: integer("reward_xp").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revertedAt: timestamp("reverted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("quest_completions_reward_xp_check", sql`${table.rewardXp} >= 0`),
    uniqueIndex("quest_completions_active_quest_unique")
      .on(table.userId, table.questId)
      .where(sql`${table.revertedAt} is null`),
  ],
);

export type QuestCompletion = typeof questCompletions.$inferSelect;
