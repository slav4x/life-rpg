import {
  date,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { tasks } from "./tasks";
import { users } from "./users";

/** Immutable record of a task completion (SPEC §10, §11). */
export const taskCompletions = pgTable(
  "task_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    localDate: date("local_date", { mode: "string" }).notNull(),
    finalXp: integer("final_xp").notNull(),
    revertedAt: timestamp("reverted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("task_completions_user_task_unique").on(table.userId, table.taskId),
    unique("task_completions_user_key_unique").on(
      table.userId,
      table.idempotencyKey,
    ),
  ],
);

export type TaskCompletion = typeof taskCompletions.$inferSelect;
