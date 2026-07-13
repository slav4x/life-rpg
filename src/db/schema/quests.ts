import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
}, (table) => [
  check("quests_type_check", sql`${table.type} in ('main', 'side', 'long_term')`),
  check(
    "quests_status_check",
    sql`${table.status} in ('draft', 'active', 'completed', 'archived')`,
  ),
  check("quests_reward_xp_check", sql`${table.rewardXp} between 0 and 10000`),
]);

export type Quest = typeof quests.$inferSelect;
export type NewQuest = typeof quests.$inferInsert;
