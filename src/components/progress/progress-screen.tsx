import Link from "next/link";

import type {
  ProgressData,
  ProgressPeriod,
} from "@/application/progress/get-progress";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import { XpChart } from "./xp-chart";

const PERIODS: { value: ProgressPeriod; label: string }[] = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "all", label: "Всё время" },
];

function eventLabel(kind: ProgressData["recent"][number]["kind"]): string {
  if (kind === "reversal") return "Отмена действия";
  if (kind === "quest") return "Квест";
  if (kind === "task") return "Действие";
  return "Корректировка";
}

function eventDate(localDate: string | null, createdAt: string): string {
  const date = localDate
    ? new Date(`${localDate}T00:00:00`)
    : new Date(createdAt);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col rounded-xl border bg-card px-3 py-2.5">
      <span className="text-lg font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function ProgressScreen({ data }: { data: ProgressData }) {
  const maxAttr = Math.max(1, ...data.attributes.map((a) => a.xp));

  return (
    <div className="flex flex-col gap-5 py-2">
      <h1 className="text-xl font-semibold tracking-tight">Прогресс</h1>

      <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
        {PERIODS.map((p) => (
          <Link
            key={p.value}
            href={`/progress?period=${p.value}`}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-md text-center",
              data.period === p.value
                ? "bg-background font-medium"
                : "text-muted-foreground",
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="XP: задачи + квесты" value={data.totalXp} />
        <Stat label="Задачи" value={data.completedTasks} />
        <Stat
          label="Серия тек./рекорд"
          value={`${data.streak.current}/${data.streak.best}`}
        />
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Эта неделя</h2>
          <span className="text-xs text-muted-foreground">
            {shortDate(data.week.from)} — {shortDate(data.week.to)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="XP" value={data.week.xp} />
          <Stat label="Выполнено" value={data.week.completedTasks} />
          <Stat label="Пропущено" value={data.week.missedTasks} />
          <Stat label="Квестов завершено" value={data.week.completedQuests} />
        </div>
        {data.week.directions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="w-full text-muted-foreground">
              Основные направления
            </span>
            {data.week.directions.map((direction) => (
              <span key={direction.code} className="rounded-full bg-muted px-2 py-1">
                {direction.name} · {direction.xp} XP
              </span>
            ))}
          </div>
        )}
        {data.week.overdueQuests.length > 0 && (
          <div className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted-foreground">
              Требуют внимания: просроченные квесты
            </span>
            {data.week.overdueQuests.map((quest) => (
              <Link
                key={quest.id}
                href={`/quests/${quest.id}`}
                className="flex min-h-9 items-center justify-between rounded-lg border px-2.5"
              >
                <span className="truncate">{quest.title}</span>
                <span className="shrink-0 text-destructive">
                  {shortDate(quest.dueDate)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Серии по повторениям</h2>
        {data.templateStreaks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Завершите первое повторяющееся действие, чтобы начать серию.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.templateStreaks.map((streak) => (
              <div
                key={streak.templateId}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {streak.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    За неделю: {streak.weeklyCompletions} выполнений
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm font-medium">
                  {streak.current} / {streak.best}
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    сейчас / рекорд
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">XP по дням</h2>
        <XpChart data={data.daily} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">По характеристикам за период</h2>
        <div className="flex flex-col gap-2">
          {data.attributes.map((a) => (
            <div key={a.code} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span>{a.name}</span>
                <span className="text-muted-foreground">{a.xp} XP</span>
              </div>
              <Progress value={Math.round((a.xp / maxAttr) * 100)} />
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Последние события XP</h2>
        {data.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет начислений.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {data.recent.map((event) => (
              <li
                key={event.id}
                className="flex items-start justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{event.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {eventLabel(event.kind)} · {eventDate(event.localDate, event.createdAt)}
                  </span>
                  {(event.skillXp !== 0 || event.attributeXp !== 0) && (
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Навык {event.skillXp > 0 ? "+" : ""}{event.skillXp} · характеристика{" "}
                      {event.attributeXp > 0 ? "+" : ""}{event.attributeXp} XP
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-medium",
                    event.amount < 0 && "text-destructive",
                  )}
                >
                  {event.amount > 0 ? "+" : ""}
                  {event.amount} XP
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
