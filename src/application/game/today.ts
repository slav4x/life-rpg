import { ensureTasksForDate } from "@/application/tasks/ensure-daily-tasks";
import { getDb } from "@/db/client";
import { listAttributes } from "@/db/repositories/attributes";
import { listActiveSkills } from "@/db/repositories/skills";
import { listStreaks } from "@/db/repositories/streaks";
import { listTasksForDate, type TaskWithSkill } from "@/db/repositories/tasks";
import { sumGlobalXp, sumXpForDate } from "@/db/repositories/xp";
import type { Attribute, Skill } from "@/db/schema";
import { levelProgress, type LevelProgress } from "@/domain/game/calculate-level";

export interface TodayData {
  date: string;
  totalXp: number;
  level: LevelProgress;
  dayXp: number;
  tasks: TaskWithSkill[];
  completedCount: number;
  totalCount: number;
  skills: Skill[];
  attributes: Attribute[];
  /** Current streak count keyed by template id. */
  streaksByTemplate: Record<string, number>;
}

/** Everything the «Сегодня» screen needs for a given local day. */
export async function getTodayData(
  userId: string,
  localDate: string,
): Promise<TodayData> {
  const db = getDb();

  // Materialise recurring tasks before reading (SPEC §12).
  await ensureTasksForDate(userId, localDate, db);

  const [totalXp, dayXp, tasks, skills, attributes, streaks] = await Promise.all([
    sumGlobalXp(db, userId),
    sumXpForDate(db, userId, localDate),
    listTasksForDate(db, userId, localDate),
    listActiveSkills(db, userId),
    listAttributes(db),
    listStreaks(db, userId),
  ]);

  const streaksByTemplate: Record<string, number> = {};
  for (const s of streaks) {
    streaksByTemplate[s.templateId] = s.currentCount;
  }

  return {
    date: localDate,
    totalXp,
    level: levelProgress(totalXp),
    dayXp,
    tasks,
    completedCount: tasks.filter((t) => t.task.status === "completed").length,
    totalCount: tasks.length,
    skills,
    attributes,
    streaksByTemplate,
  };
}
