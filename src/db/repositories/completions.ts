import { and, eq, isNull } from "drizzle-orm";

import type { DbClient } from "@/db/client";
import { taskCompletions, type TaskCompletion } from "@/db/schema";

export interface CreateCompletionInput {
  userId: string;
  taskId: string;
  idempotencyKey: string;
  localDate: string;
  finalXp: number;
  completedAt?: Date;
}

export async function createCompletion(
  db: DbClient,
  input: CreateCompletionInput,
): Promise<TaskCompletion> {
  const [completion] = await db
    .insert(taskCompletions)
    .values({
      userId: input.userId,
      taskId: input.taskId,
      idempotencyKey: input.idempotencyKey,
      localDate: input.localDate,
      finalXp: input.finalXp,
      completedAt: input.completedAt ?? new Date(),
    })
    .returning();
  return completion;
}

/** The current, non-reverted completion for a task, if any. */
export async function findActiveCompletionByTask(
  db: DbClient,
  userId: string,
  taskId: string,
): Promise<TaskCompletion | undefined> {
  const [completion] = await db
    .select()
    .from(taskCompletions)
    .where(
      and(
        eq(taskCompletions.userId, userId),
        eq(taskCompletions.taskId, taskId),
        isNull(taskCompletions.revertedAt),
      ),
    )
    .limit(1);
  return completion;
}
