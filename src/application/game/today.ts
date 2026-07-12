import { getDb } from "@/db/client";
import { listAttributes } from "@/db/repositories/attributes";
import { listActiveSkills } from "@/db/repositories/skills";
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
}

/** Everything the «Сегодня» screen needs for a given local day. */
export async function getTodayData(
  userId: string,
  localDate: string,
): Promise<TodayData> {
  const db = getDb();
  const [totalXp, dayXp, tasks, skills, attributes] = await Promise.all([
    sumGlobalXp(db, userId),
    sumXpForDate(db, userId, localDate),
    listTasksForDate(db, userId, localDate),
    listActiveSkills(db, userId),
    listAttributes(db),
  ]);

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
  };
}
