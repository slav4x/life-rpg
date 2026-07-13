"use client";

import { Download, LogOut, Pencil } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type {
  ProfileSkillOption,
  ProfileTemplate,
} from "@/application/profile/get-profile";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { TemplateFormDrawer } from "./template-form-drawer";

const THEMES = [
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
  { value: "system", label: "Системная" },
];

const TIMEZONES = [
  "Asia/Novosibirsk",
  "Asia/Yekaterinburg",
  "Asia/Vladivostok",
  "Europe/Moscow",
  "Europe/Kaliningrad",
  "UTC",
];

const DAY_LABELS = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function scheduleLabel(t: ProfileTemplate): string {
  if (t.recurrenceType === "daily") return "Каждый день";
  return (t.weekdays ?? [])
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join(", ");
}

async function patchProfile(body: Record<string, string>): Promise<boolean> {
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export function ProfileSettings({
  timezone,
  templates,
  skills,
}: {
  timezone: string;
  templates: ProfileTemplate[];
  skills: ProfileSkillOption[];
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [tz, setTz] = useState(timezone);
  const [busy, setBusy] = useState(false);

  const timezoneOptions = TIMEZONES.includes(tz) ? TIMEZONES : [tz, ...TIMEZONES];
  const active = templates.filter((t) => !t.archived);
  const archived = templates.filter((t) => t.archived);

  async function changeTheme(next: string) {
    setTheme(next);
    if (!(await patchProfile({ theme: next }))) {
      toast.error("Не удалось сохранить тему");
    }
  }

  async function changeTimezone(next: string) {
    setTz(next);
    if (await patchProfile({ timezone: next })) {
      toast.success("Часовой пояс обновлён");
      router.refresh();
    } else {
      toast.error("Не удалось обновить часовой пояс");
    }
  }

  async function patchTemplate(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/task-templates/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) toast.error("Не удалось обновить шаблон");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function archiveTemplate(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/task-templates/${id}`, { method: "DELETE" });
      if (!res.ok) toast.error("Не удалось архивировать шаблон");
      else {
        toast.success("Шаблон архивирован");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Тема</h2>
        <div className="flex gap-2">
          {THEMES.map((t) => (
            <Button
              key={t.value}
              size="sm"
              variant={theme === t.value ? "default" : "outline"}
              onClick={() => changeTheme(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Часовой пояс</h2>
        <Select value={tz} onValueChange={changeTimezone}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timezoneOptions.map((zone) => (
              <SelectItem key={zone} value={zone}>
                {zone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Шаблоны задач</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Активных шаблонов нет.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-2 rounded-xl border bg-card px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{t.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {scheduleLabel(t)}
                    {!t.isActive && " · пауза"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <TemplateFormDrawer
                    template={t}
                    skills={skills}
                    trigger={
                      <Button size="sm" variant="ghost" disabled={busy}>
                        <Pencil className="size-3.5" />
                        Изменить
                      </Button>
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      patchTemplate(t.id, { isActive: !t.isActive })
                    }
                  >
                    {t.isActive ? "Пауза" : "Возобновить"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    disabled={busy}
                    onClick={() => archiveTemplate(t.id)}
                  >
                    Архив
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {archived.length > 0 && (
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer">
              Архив ({archived.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {archived.map((t) => (
                <li key={t.id} className="flex justify-between px-1 text-xs">
                  <span className="truncate">{t.title}</span>
                  <span>{scheduleLabel(t)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Данные</h2>
        <a href="/api/export" download>
          <Button variant="outline" className="w-full">
            <Download className="size-4" />
            Экспорт в JSON
          </Button>
        </a>
        <Button
          variant="ghost"
          className="text-destructive"
          onClick={logout}
          disabled={busy}
        >
          <LogOut className="size-4" />
          Выйти
        </Button>
      </section>
    </div>
  );
}
