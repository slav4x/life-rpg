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

function scopeLabel(scope: string, sourceType: string): string {
  if (sourceType === "reversal") return "Отмена";
  if (sourceType === "quest_completion") return "Квест";
  if (scope === "skill") return "Навык";
  if (scope === "attribute") return "Характеристика";
  return "Общий";
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
              "flex-1 rounded-md py-1.5 text-center",
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
        <Stat label="XP за период" value={data.totalXp} />
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
        <h2 className="text-sm font-medium">По характеристикам</h2>
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
        <h2 className="text-sm font-medium">Последние начисления</h2>
        {data.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет начислений.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {data.recent.map((t, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">
                  {scopeLabel(t.scope, t.sourceType)}
                </span>
                <span className={t.amount < 0 ? "text-destructive" : ""}>
                  {t.amount > 0 ? "+" : ""}
                  {t.amount} XP
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
