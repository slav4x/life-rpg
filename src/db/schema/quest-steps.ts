import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { quests } from "./quests";

/** A single measurable step of a quest (SPEC §5.7, §10). */
export const questSteps = pgTable("quest_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  questId: uuid("quest_id")
    .notNull()
    .references(() => quests.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  isRequired: boolean("is_required").notNull().default(true),
  sortOrder: integer("sort_order").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type QuestStep = typeof questSteps.$inferSelect;
