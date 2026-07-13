import { Sparkles } from "lucide-react";

import { getAuthenticatedUser } from "@/application/auth/session";
import { ensureWorkspace } from "@/application/game/bootstrap";
import { getTodayData } from "@/application/game/today";
import { ensureTasksForDate } from "@/application/tasks/ensure-daily-tasks";
import { getPlanningSummary } from "@/application/tasks/planning";
import { TelegramLogin } from "@/components/auth/telegram-login";
import { TodayScreen } from "@/components/today/today-screen";
import type { TaskVM } from "@/components/today/types";
import { calculateFinalXp } from "@/domain/game/calculate-xp";
import { isDifficulty, isTaskPriority } from "@/domain/game/constants";
import {
  addDaysToDate,
  getLocalDate,
  isValidDateString,
} from "@/lib/dates/local-date";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <Sparkles className="size-8 text-primary" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Life RPG</h1>
          <p className="max-w-xs text-sm text-muted-foreground">
            Персональный трекер прогресса в стиле RPG.
          </p>
        </div>
        <TelegramLogin />
      </div>
    );
  }

  await ensureWorkspace(user.id);
  const today = getLocalDate(user.timezone);
  const { date: requested } = await searchParams;
  const viewedDate =
    requested && isValidDateString(requested) ? requested : today;

  // Keep a bounded planning horizon materialised; never create past occurrences.
  const horizon = Array.from({ length: 7 }, (_, index) =>
    addDaysToDate(today, index),
  );
  await Promise.all(horizon.map((date) => ensureTasksForDate(user.id, date)));
  if (viewedDate > horizon[horizon.length - 1]) {
    await ensureTasksForDate(user.id, viewedDate);
  }

  const [data, planning] = await Promise.all([
    getTodayData(user.id, viewedDate),
    getPlanningSummary(user.id, today),
  ]);

  const tasks: TaskVM[] = data.tasks.map(({ task, skill }) => {
    const difficulty = isDifficulty(task.difficulty) ? task.difficulty : "normal";
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      skillId: task.skillId,
      skillName: skill.name,
      baseXp: task.baseXp,
      difficulty,
      priority: isTaskPriority(task.priority) ? task.priority : "normal",
      status: task.status,
      finalXp: calculateFinalXp(task.baseXp, difficulty),
      estimatedMinutes: task.estimatedMinutes,
      focusPosition: task.focusPosition,
      templateId: task.templateId,
      questStepId: task.questStepId,
      streak: task.templateId
        ? (data.streaksByTemplate[task.templateId] ?? 0)
        : null,
    };
  });

  return (
    <TodayScreen
      key={data.date}
      userName={user.firstName}
      date={data.date}
      today={today}
      level={data.level}
      totalXp={data.totalXp}
      dayXp={data.dayXp}
      completedCount={data.completedCount}
      totalCount={data.totalCount}
      tasks={tasks}
      skills={data.skills.map((s) => ({
        id: s.id,
        name: s.name,
        attributeId: s.attributeId,
      }))}
      planning={planning}
    />
  );
}
