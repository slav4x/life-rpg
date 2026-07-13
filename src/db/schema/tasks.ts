import { sql } from "drizzle-orm";
import {
  date,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { questSteps } from "./quest-steps";
import { skills } from "./skills";
import { taskTemplates } from "./task-templates";
import { users } from "./users";

/**
 * A concrete action assigned to a date (SPEC §5.4, §10). It may originate from
 * a recurring template or be linked to a quest step.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => taskTemplates.id, {
      onDelete: "set null",
    }),
    questStepId: uuid("quest_step_id").references(() => questSteps.id, {
      onDelete: "set null",
    }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id),
    title: text("title").notNull(),
    description: text("description"),
    localDate: date("local_date", { mode: "string" }).notNull(),
    baseXp: integer("base_xp").notNull(),
    difficulty: text("difficulty").notNull(),
    priority: text("priority").notNull().default("normal"),
    status: text("status").notNull().default("pending"),
    estimatedMinutes: integer("estimated_minutes"),
    focusPosition: integer("focus_position"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("tasks_base_xp_check", sql`${table.baseXp} between 5 and 250`),
    check(
      "tasks_difficulty_check",
      sql`${table.difficulty} in ('easy', 'normal', 'hard', 'epic')`,
    ),
    check(
      "tasks_status_check",
      sql`${table.status} in ('pending', 'completed', 'cancelled')`,
    ),
    check(
      "tasks_priority_check",
      sql`${table.priority} in ('high', 'normal', 'low')`,
    ),
    check(
      "tasks_estimated_minutes_check",
      sql`${table.estimatedMinutes} is null or ${table.estimatedMinutes} between 1 and 1440`,
    ),
    check(
      "tasks_focus_position_check",
      sql`${table.focusPosition} is null or ${table.focusPosition} between 1 and 3`,
    ),
    // One template task per user per day (SPEC §10, §12).
    uniqueIndex("tasks_user_date_template_unique")
      .on(table.userId, table.localDate, table.templateId)
      .where(sql`${table.templateId} is not null`),
    uniqueIndex("tasks_active_quest_step_unique")
      .on(table.questStepId)
      .where(
        sql`${table.questStepId} is not null and ${table.status} <> 'cancelled'`,
      ),
    uniqueIndex("tasks_user_date_focus_position_unique")
      .on(table.userId, table.localDate, table.focusPosition)
      .where(
        sql`${table.focusPosition} is not null and ${table.status} = 'pending'`,
      ),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
