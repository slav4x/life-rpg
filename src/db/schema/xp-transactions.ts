import { sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { attributes } from "./attributes";
import { skills } from "./skills";
import { users } from "./users";

/**
 * The XP journal — the source of truth for all progress (SPEC §10, §23).
 * Values are never mutated; corrections are written as compensating rows.
 */
export const xpTransactions = pgTable(
  "xp_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    scope: text("scope").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    attributeId: uuid("attribute_id").references(() => attributes.id),
    skillId: uuid("skill_id").references(() => skills.id),
    baseXp: integer("base_xp").notNull(),
    multiplier: numeric("multiplier", { precision: 5, scale: 2 })
      .notNull()
      .default("1"),
    reversalOfId: uuid("reversal_of_id").references(
      (): AnyPgColumn => xpTransactions.id,
    ),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Idempotent accrual per source, except reversals and manual adjustments.
    uniqueIndex("xp_transactions_accrual_unique")
      .on(table.userId, table.scope, table.sourceType, table.sourceId)
      .where(sql`${table.sourceType} not in ('reversal', 'manual_adjustment')`),
  ],
);

export type XpScope = "global" | "skill" | "attribute";
export type XpTransaction = typeof xpTransactions.$inferSelect;
export type NewXpTransaction = typeof xpTransactions.$inferInsert;
