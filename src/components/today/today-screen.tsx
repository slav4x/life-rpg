"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { PlanningSummary } from "@/application/tasks/planning";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import type { LevelProgress } from "@/domain/game/calculate-level";
import { addDaysToDate } from "@/lib/dates/local-date";

import { OverdueTasksPanel } from "./overdue-tasks-panel";
import { TaskFormDrawer } from "./task-form-drawer";
import { TaskItem } from "./task-item";
import type { SkillOption, TaskVM } from "./types";

const SHOW_COMPLETED_KEY = "life-rpg:today:show-completed";

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
  planning: PlanningSummary;
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

function shortDate(date: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T00:00:00`));
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

function durationSummary(tasks: TaskVM[]): string {
  const estimated = tasks.reduce(
    (sum, task) => sum + (task.estimatedMinutes ?? 0),
    0,
  );
  const withoutEstimate = tasks.filter(
    (task) => task.estimatedMinutes == null,
  ).length;
  const parts = [formatMinutes(estimated)];
  if (withoutEstimate > 0) parts.push(`${withoutEstimate} без оценки`);
  return parts.join(" · ");
}

export function TodayScreen(props: TodayScreenProps) {
  const pending = props.tasks.filter((task) => task.status === "pending");
  const focus = pending
    .filter((task) => task.focusPosition != null)
    .sort((a, b) => (a.focusPosition ?? 0) - (b.focusPosition ?? 0));
  const regularPending = pending.filter((task) => task.focusPosition == null);
  const done = props.tasks.filter((task) => task.status !== "pending");
  const levelPercent = Math.round(props.level.ratio * 100);
  const isToday = props.date === props.today;
  const prev = addDaysToDate(props.date, -1);
  const next = addDaysToDate(props.date, 1);
  const [showCompleted, setShowCompleted] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(
    !isToday || props.planning.overdueCount > 0,
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setShowCompleted(localStorage.getItem(SHOW_COMPLETED_KEY) === "true");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  function updateCompletedVisibility(value: boolean | "indeterminate") {
    const visible = value === true;
    setShowCompleted(visible);
    localStorage.setItem(SHOW_COMPLETED_KEY, String(visible));
  }

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
            className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label="Предыдущий день"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium capitalize">
              {formatDate(props.date)}
            </span>
            {!isToday && (
              <Link
                href="/"
                className="inline-flex min-h-11 items-center text-xs text-muted-foreground underline"
              >
                к сегодня
              </Link>
            )}
          </div>
          <Link
            href={dateHref(next, props.today)}
            className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
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

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-3">
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
          aria-expanded={planningOpen}
          aria-controls="planning-content"
          onClick={() => setPlanningOpen((open) => !open)}
        >
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="size-4" />
            Планирование
          </h2>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {!planningOpen && (
              <span>
                Сегодня {props.planning.todayCount} · Просрочено{" "}
                {props.planning.overdueCount}
              </span>
            )}
            {planningOpen ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </span>
        </button>

        {planningOpen && (
          <div id="planning-content" className="flex flex-col gap-3">
            <form className="flex items-center gap-1" action="/">
              <input
                type="date"
                name="date"
                defaultValue={props.date}
                aria-label="Перейти к дате"
                className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs"
              />
              <button
                type="submit"
                className="h-9 rounded-md border px-2 text-xs hover:bg-muted"
              >
                Перейти
              </button>
            </form>

            <div className="grid grid-cols-3 gap-2 text-center">
              <a href="#overdue" className="rounded-lg bg-muted px-2 py-2">
                <span className="block text-lg font-semibold">
                  {props.planning.overdueCount}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Просрочено
                </span>
              </a>
              <Link href="/" className="rounded-lg bg-muted px-2 py-2">
                <span className="block text-lg font-semibold">
                  {props.planning.todayCount}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Сегодня
                </span>
              </Link>
              <a href="#next-seven" className="rounded-lg bg-muted px-2 py-2">
                <span className="block text-lg font-semibold">
                  {props.planning.nextSevenCount}
                </span>
                <span className="text-[11px] text-muted-foreground">7 дней</span>
              </a>
            </div>

            {props.planning.overdueTasks.length > 0 && (
              <OverdueTasksPanel
                tasks={props.planning.overdueTasks}
                today={props.today}
              />
            )}

            <div id="next-seven" className="flex flex-wrap gap-2">
              {Array.from({ length: 7 }, (_, index) => {
                const date = addDaysToDate(props.today, index);
                const count =
                  props.planning.nextSeven.find((item) => item.date === date)
                    ?.count ?? 0;
                return (
                  <Link
                    key={date}
                    href={dateHref(date, props.today)}
                    className="flex min-w-14 flex-1 flex-col items-center rounded-md border px-1 py-1.5 text-xs"
                  >
                    <span>{shortDate(date)}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Star className="size-4 fill-current text-primary" />
            Фокус дня
            <span className="text-muted-foreground">{focus.length} / 3</span>
          </h2>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3 className="size-3.5" />
            {durationSummary(focus)}
          </span>
        </div>
        {focus.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {focus.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                date={props.date}
                skills={props.skills}
                compact
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-primary/20 px-3 py-3 text-xs text-muted-foreground">
            Отметьте звёздочкой до трёх главных задач.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">
              Задачи
              <span className="ml-2 text-muted-foreground">
                {props.completedCount} / {props.totalCount}
              </span>
            </h2>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" />
              План: {durationSummary(pending)}
            </span>
          </div>
          <TaskFormDrawer date={props.date} skills={props.skills} />
        </div>

        {done.length > 0 && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 self-start text-sm text-muted-foreground">
            <Checkbox
              checked={showCompleted}
              onCheckedChange={updateCompletedVisibility}
              aria-label="Показывать завершённые задачи"
            />
            Показывать завершённые ({done.length})
          </label>
        )}

        {props.tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            На этот день задач нет. Добавьте действие.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {regularPending.length > 0 && (
              <ul className="flex flex-col gap-2">
                {regularPending.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    date={props.date}
                    skills={props.skills}
                  />
                ))}
              </ul>
            )}
            {regularPending.length === 0 && pending.length > 0 && (
              <p className="rounded-xl border border-dashed px-4 py-4 text-center text-xs text-muted-foreground">
                Остальных незавершённых задач нет.
              </p>
            )}
            {showCompleted && done.length > 0 && (
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
