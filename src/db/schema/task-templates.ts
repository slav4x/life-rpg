import {
  boolean,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { skills } from "./skills";
import { users } from "./users";

/**
 * Recurring task template (SPEC §10). Daily tasks are materialised lazily from
 * active templates on read (SPEC §12) — no cron.
 */
export const taskTemplates = pgTable("task_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id")
    .notNull()
    .references(() => skills.id),
  title: text("title").notNull(),
  description: text("description"),
  baseXp: integer("base_xp").notNull(),
  difficulty: text("difficulty").notNull(),
  // "daily" | "weekdays"
  recurrenceType: text("recurrence_type").notNull(),
  // ISO weekdays (1=Mon .. 7=Sun) when recurrenceType is "weekdays".
  weekdays: smallint("weekdays").array(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type NewTaskTemplate = typeof taskTemplates.$inferInsert;
