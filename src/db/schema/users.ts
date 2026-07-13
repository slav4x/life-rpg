import { sql } from "drizzle-orm";
import { bigint, check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Character owner. One row per allowlisted Telegram account (SPEC §10).
 * All timestamps are stored as `timestamptz` in UTC (SPEC §8.4).
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Telegram IDs may exceed 2^53, so keep them as bigint end-to-end.
    telegramId: bigint("telegram_id", { mode: "bigint" }).notNull().unique(),
    telegramUsername: text("telegram_username"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    photoUrl: text("photo_url"),
    timezone: text("timezone").notNull().default("Asia/Novosibirsk"),
    theme: text("theme").notNull().default("system"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("users_theme_check", sql`${table.theme} in ('light', 'dark', 'system')`),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
