import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

/** System reference table of the six fixed attributes (SPEC §10). */
export const attributes = pgTable("attributes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull(),
});

export type Attribute = typeof attributes.$inferSelect;
