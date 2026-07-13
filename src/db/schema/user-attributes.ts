import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { attributes } from "./attributes";
import { users } from "./users";

/** Cached attribute progress. Source of truth is the XP journal (SPEC §10). */
export const userAttributes = pgTable(
  "user_attributes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    attributeId: uuid("attribute_id")
      .notNull()
      .references(() => attributes.id, { onDelete: "cascade" }),
    xp: integer("xp").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.attributeId] }),
    check("user_attributes_xp_check", sql`${table.xp} >= 0`),
  ],
);

export type UserAttribute = typeof userAttributes.$inferSelect;
