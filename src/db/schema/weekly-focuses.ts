import {
  date,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

/** User-written focus for a calendar week. */
export const weeklyFocuses = pgTable(
  "weekly_focuses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: date("week_start", { mode: "string" }).notNull(),
    focus: text("focus").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("weekly_focuses_user_week_unique").on(
      table.userId,
      table.weekStart,
    ),
  ],
);

export type WeeklyFocus = typeof weeklyFocuses.$inferSelect;
