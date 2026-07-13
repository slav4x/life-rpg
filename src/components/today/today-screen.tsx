import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Progress } from "@/components/ui/progress";
import type { LevelProgress } from "@/domain/game/calculate-level";
import { addDaysToDate } from "@/lib/dates/local-date";

import { TaskFormDrawer } from "./task-form-drawer";
import { TaskItem } from "./task-item";
import type { SkillOption, TaskVM } from "./types";

interface TodayScreenProps {
  userName: string;
  date: string;
  today: string;
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

function dateHref(date: string, today: string): string {
  return date === today ? "/" : `/?date=${date}`;
}

export function TodayScreen(props: TodayScreenProps) {
  const pending = props.tasks.filter((t) => t.status === "pending");
  const done = props.tasks.filter((t) => t.status !== "pending");
  const levelPercent = Math.round(props.level.ratio * 100);
  const isToday = props.date === props.today;
  const prev = addDaysToDate(props.date, -1);
  const next = addDaysToDate(props.date, 1);

  return (
    <div className="flex flex-col gap-5 py-2">
      <header className="flex flex-col gap-4">
        {isToday && (
          <h1 className="text-xl font-semibold tracking-tight">
            Привет, {props.userName}
          </h1>
        )}

        <div className="flex items-center justify-between">
          <Link
            href={dateHref(prev, props.today)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Предыдущий день"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium capitalize">
              {formatDate(props.date)}
            </span>
            {!isToday && (
              <Link href="/" className="text-xs text-muted-foreground underline">
                к сегодня
              </Link>
            )}
          </div>
          <Link
            href={dateHref(next, props.today)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Следующий день"
          >
            <ChevronRight className="size-5" />
          </Link>
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
            <span>За день: +{props.dayXp} XP</span>
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
          <TaskFormDrawer date={props.date} skills={props.skills} />
        </div>

        {props.tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            На этот день задач нет. Добавьте действие.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pending.length > 0 && (
              <ul className="flex flex-col gap-2">
                {pending.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    date={props.date}
                    skills={props.skills}
                  />
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
                    <TaskItem
                      key={task.id}
                      task={task}
                      date={props.date}
                      skills={props.skills}
                    />
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
