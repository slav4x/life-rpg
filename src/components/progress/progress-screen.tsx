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
