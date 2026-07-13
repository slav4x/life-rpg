import { sql } from "drizzle-orm";
import {
  check,
  date,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { taskTemplates } from "./task-templates";
import { users } from "./users";

/** Per-template completion streak (SPEC §5.6, §10). */
export const streaks = pgTable(
  "streaks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => taskTemplates.id, { onDelete: "cascade" }),
    currentCount: integer("current_count").notNull().default(0),
    bestCount: integer("best_count").notNull().default(0),
    lastCompletedDate: date("last_completed_date", { mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("streaks_user_template_unique").on(table.userId, table.templateId),
    check(
      "streaks_counts_check",
      sql`${table.currentCount} >= 0 and ${table.bestCount} >= ${table.currentCount}`,
    ),
  ],
);

export type Streak = typeof streaks.$inferSelect;
