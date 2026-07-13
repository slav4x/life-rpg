import { GameError } from "@/application/game/errors";
import { addDaysToDate } from "@/lib/dates/local-date";

export const TASK_BACKDATE_LIMIT_DAYS = 7;

/** Tasks may be completed today or up to seven local calendar days ago. */
export function assertTaskCompletionDate(
  taskDate: string,
  today: string,
): void {
  if (taskDate > today) {
    throw new GameError("task_date_future", "Future tasks cannot be completed");
  }
  if (taskDate < addDaysToDate(today, -TASK_BACKDATE_LIMIT_DAYS)) {
    throw new GameError(
      "task_date_too_old",
      "Tasks can only be completed up to seven days later",
    );
  }
}
