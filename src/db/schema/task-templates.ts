import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
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
  estimatedMinutes: integer("estimated_minutes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
}, (table) => [
  check("task_templates_base_xp_check", sql`${table.baseXp} between 5 and 250`),
  check(
    "task_templates_difficulty_check",
    sql`${table.difficulty} in ('easy', 'normal', 'hard', 'epic')`,
  ),
  check(
    "task_templates_estimated_minutes_check",
    sql`${table.estimatedMinutes} is null or ${table.estimatedMinutes} between 1 and 1440`,
  ),
  check(
    "task_templates_recurrence_check",
    sql`(${table.recurrenceType} = 'daily' and ${table.weekdays} is null) or (${table.recurrenceType} = 'weekdays' and cardinality(${table.weekdays}) between 1 and 7 and ${table.weekdays} <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[])`,
  ),
  uniqueIndex("task_templates_user_live_title_unique")
    .on(table.userId, sql`lower(btrim(${table.title}))`)
    .where(sql`${table.archivedAt} is null`),
]);

export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type NewTaskTemplate = typeof taskTemplates.$inferInsert;
