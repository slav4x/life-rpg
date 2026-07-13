import type { ProfileData } from "@/application/profile/get-profile";
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
        <div className="grid grid-cols-4 gap-2">
          {data.achievements.map((a) => (
            <div
              key={a.code}
              title={a.description}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border bg-card px-2 py-3 text-center",
                !a.unlocked && "opacity-30",
              )}
            >
              <span className="text-xl">{a.icon ?? "🏅"}</span>
              <span className="text-[11px] leading-tight">{a.name}</span>
            </div>
          ))}
        </div>
      </section>

      <ProfileSettings
        timezone={timezone}
        templates={data.templates.map((t) => ({
          id: t.id,
          title: t.title,
          isActive: t.isActive,
        }))}
      />
    </div>
  );
}
