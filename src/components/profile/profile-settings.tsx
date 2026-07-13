"use client";

import { Download, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProfileTemplate {
  id: string;
  title: string;
  isActive: boolean;
}

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
}: {
  timezone: string;
  templates: ProfileTemplate[];
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [tz, setTz] = useState(timezone);
  const [busy, setBusy] = useState(false);

  const timezoneOptions = TIMEZONES.includes(tz) ? TIMEZONES : [tz, ...TIMEZONES];

  async function changeTheme(next: string) {
    setTheme(next);
    await patchProfile({ theme: next });
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

  async function archiveTemplate(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/task-templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Не удалось архивировать шаблон");
        return;
      }
      toast.success("Шаблон архивирован");
      router.refresh();
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

  const activeTemplates = templates.filter((t) => t.isActive);

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
        {activeTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Активных шаблонов нет.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {activeTemplates.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm"
              >
                <span className="truncate">{t.title}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  disabled={busy}
                  onClick={() => archiveTemplate(t.id)}
                >
                  Архивировать
                </Button>
              </li>
            ))}
          </ul>
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
        <Button variant="ghost" className="text-destructive" onClick={logout} disabled={busy}>
          <LogOut className="size-4" />
          Выйти
        </Button>
      </section>
    </div>
  );
}
