import { sql } from "drizzle-orm";
import {
  date,
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
 * A concrete action assigned to a date (SPEC §5.4, §10). May originate from a
 * recurring template; the `quest_step_id` link arrives in a later stage.
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
    status: text("status").notNull().default("pending"),
    estimatedMinutes: integer("estimated_minutes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // One template task per user per day (SPEC §10, §12).
    uniqueIndex("tasks_user_date_template_unique")
      .on(table.userId, table.localDate, table.templateId)
      .where(sql`${table.templateId} is not null`),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
