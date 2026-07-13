import {
  boolean,
  date,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { attributes } from "./attributes";
import { users } from "./users";

/** A goal made of measurable steps (SPEC §5.7, §10). */
export const quests = pgTable("quests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  attributeId: uuid("attribute_id").references(() => attributes.id),
  title: text("title").notNull(),
  description: text("description"),
  // "main" | "side" | "long_term"
  type: text("type").notNull(),
  // "draft" | "active" | "completed" | "archived"
  status: text("status").notNull().default("draft"),
  rewardXp: integer("reward_xp").notNull().default(0),
  dueDate: date("due_date", { mode: "string" }),
  manualCompletion: boolean("manual_completion").notNull().default(true),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Quest = typeof quests.$inferSelect;
export type NewQuest = typeof quests.$inferInsert;
