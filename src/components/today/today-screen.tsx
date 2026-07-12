import { Progress } from "@/components/ui/progress";
import type { LevelProgress } from "@/domain/game/calculate-level";

import { AddActionDrawer } from "./add-action-drawer";
import { TaskItem } from "./task-item";
import type { SkillOption, TaskVM } from "./types";

interface TodayScreenProps {
  userName: string;
  date: string;
  level: LevelProgress;
  totalXp: number;
  dayXp: number;
  completedCount: number;
  totalCount: number;
  tasks: TaskVM[];
  skills: SkillOption[];
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T00:00:00`));
}

export function TodayScreen(props: TodayScreenProps) {
  const pending = props.tasks.filter((t) => t.status === "pending");
  const done = props.tasks.filter((t) => t.status !== "pending");
  const levelPercent = Math.round(props.level.ratio * 100);

  return (
    <div className="flex flex-col gap-5 py-2">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Привет, {props.userName}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            {formatDate(props.date)}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">
              Уровень {props.level.level}
            </span>
            <span className="text-xs text-muted-foreground">
              {props.level.xpIntoLevel} / {props.level.xpForNextLevel} XP
            </span>
          </div>
          <Progress value={levelPercent} className="mt-2" />
          <div className="mt-3 flex justify-between text-xs text-muted-foreground">
            <span>Всего: {props.totalXp} XP</span>
            <span>Сегодня: +{props.dayXp} XP</span>
          </div>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">
            Задачи
            <span className="ml-2 text-muted-foreground">
              {props.completedCount} / {props.totalCount}
            </span>
          </h2>
          <AddActionDrawer date={props.date} skills={props.skills} />
        </div>

        {props.tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            На сегодня задач нет. Добавьте первое действие.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pending.length > 0 && (
              <ul className="flex flex-col gap-2">
                {pending.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </ul>
            )}
            {done.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Выполнено
                </p>
                <ul className="flex flex-col gap-2">
                  {done.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
