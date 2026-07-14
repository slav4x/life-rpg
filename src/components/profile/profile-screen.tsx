import { Check, ChevronRight, Lock, Repeat2 } from "lucide-react";
import Link from "next/link";

import type { ProfileData } from "@/application/profile/get-profile";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import { ProfileSettings } from "./profile-settings";

interface ProfileScreenProps {
  name: string;
  photoUrl: string | null;
  username: string | null;
  timezone: string;
  data: ProfileData;
}

function formatUnlockDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function ProfileScreen({
  name,
  photoUrl,
  username,
  timezone,
  data,
}: ProfileScreenProps) {
  const unlockedCount = data.achievements.filter((a) => a.unlocked).length;

  return (
    <div className="flex flex-col gap-6 py-2">
      <header className="flex items-center gap-3">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            className="size-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-lg font-medium">
            {name.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{name}</h1>
          {username && (
            <p className="text-xs text-muted-foreground">@{username}</p>
          )}
        </div>
      </header>

      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Уровень {data.level.level}</span>
          <span className="text-xs text-muted-foreground">
            {data.level.xpIntoLevel} / {data.level.xpForNextLevel} XP
          </span>
        </div>
        <Progress value={Math.round(data.level.ratio * 100)} className="mt-2" />
        <p className="mt-3 text-xs text-muted-foreground">
          Всего: {data.totalXp} XP
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Характеристики</h2>
        <div className="grid grid-cols-2 gap-2">
          {data.attributes.map((a) => (
            <div
              key={a.code}
              className="flex flex-col rounded-xl border bg-card px-3 py-2.5"
            >
              <span className="text-sm font-medium">{a.name}</span>
              <span className="text-xs text-muted-foreground">
                Ур. {a.level} · {a.xp} XP
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">
          Достижения
          <span className="ml-2 text-muted-foreground">
            {unlockedCount} / {data.achievements.length}
          </span>
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {data.achievements.map((a) => (
            <div
              key={a.code}
              className={cn(
                "flex items-start gap-3 rounded-xl border bg-card p-3",
                !a.unlocked && "bg-muted/30 text-muted-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl",
                  !a.unlocked && "grayscale",
                )}
              >
                {a.icon ?? "🏅"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {a.name}
                  </span>
                  <Badge
                    variant={a.unlocked ? "secondary" : "outline"}
                    className="shrink-0 gap-1 font-normal"
                  >
                    {a.unlocked ? (
                      <Check className="size-3" />
                    ) : (
                      <Lock className="size-3" />
                    )}
                    {a.unlocked ? "Получено" : "Закрыто"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {a.description}
                </p>
                {a.unlockedAt && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {formatUnlockDate(a.unlockedAt)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Управление</h2>
        <Link
          href="/repetitions"
          className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-3 py-2.5"
        >
          <Repeat2 className="size-5 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Повторения</span>
            <span className="block text-xs text-muted-foreground">
              Расписание, пауза и архив
            </span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </section>

      <ProfileSettings timezone={timezone} />
    </div>
  );
}
