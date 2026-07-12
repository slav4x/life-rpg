import {
  date,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { skills } from "./skills";
import { users } from "./users";

/**
 * A concrete action assigned to a date (SPEC §5.4, §10). Stage 2 covers
 * one-off tasks; `template_id` / `quest_step_id` links arrive in later stages.
 */
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id")
    .notNull()
    .references(() => skills.id),
  title: text("title").notNull(),
  description: text("description"),
  localDate: date("local_date", { mode: "string" }).notNull(),
  baseXp: integer("base_xp").notNull(),
  difficulty: text("difficulty").notNull(),
  status: text("status").notNull().default("pending"),
  estimatedMinutes: integer("estimated_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
