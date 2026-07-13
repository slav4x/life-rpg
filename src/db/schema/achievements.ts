import { integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

/** System catalogue of achievements (SPEC §5.8, §10). */
export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon"),
  ruleType: text("rule_type").notNull(),
  ruleConfig: jsonb("rule_config").$type<{ threshold: number }>().notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export type Achievement = typeof achievements.$inferSelect;
