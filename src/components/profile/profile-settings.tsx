"use client";

import { Download, LogOut, Pencil, Upload } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useState } from "react";
import { toast } from "sonner";

import type {
  ProfileSkillOption,
  ProfileTemplate,
} from "@/application/profile/get-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getApiErrorMessage,
  NETWORK_ERROR_MESSAGE,
} from "@/lib/http/client-error";

import { TemplateFormDrawer } from "./template-form-drawer";

const THEMES = [
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
  { value: "system", label: "Системная" },
];

const FALLBACK_TIMEZONES = [
  "Asia/Novosibirsk",
  "Asia/Yekaterinburg",
  "Asia/Vladivostok",
  "Europe/Moscow",
  "Europe/Kaliningrad",
  "UTC",
];

const TIMEZONES =
  (
    Intl as typeof Intl & {
      supportedValuesOf?: (key: "timeZone") => string[];
    }
  ).supportedValuesOf?.("timeZone") ?? FALLBACK_TIMEZONES;

const DAY_LABELS = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function scheduleLabel(t: ProfileTemplate): string {
  if (t.recurrenceType === "daily") return "Каждый день";
  return (t.weekdays ?? [])
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join(", ");
}

async function patchProfile(body: Record<string, string>): Promise<Response> {
  return fetch("/api/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
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
  const [savedTz, setSavedTz] = useState(timezone);
  const [busy, setBusy] = useState(false);

  const timezoneOptions = TIMEZONES.includes(tz) ? TIMEZONES : [tz, ...TIMEZONES];
  const active = templates.filter((t) => !t.archived);
  const archived = templates.filter((t) => t.archived);

  async function changeTheme(next: string) {
    const previous = theme ?? "system";
    setTheme(next);
    setBusy(true);
    try {
      const response = await patchProfile({ theme: next });
      if (!response.ok) {
        setTheme(previous);
        toast.error(await getApiErrorMessage(response, "Не удалось сохранить тему."));
      }
    } catch {
      setTheme(previous);
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function changeTimezone() {
    setBusy(true);
    try {
      const response = await patchProfile({ timezone: tz.trim() });
      if (response.ok) {
        setSavedTz(tz.trim());
        setTz(tz.trim());
        toast.success("Часовой пояс обновлён");
        router.refresh();
      } else {
        setTz(savedTz);
        toast.error(
          await getApiErrorMessage(response, "Укажите корректную IANA timezone."),
        );
      }
    } catch {
      setTz(savedTz);
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
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
      if (!res.ok) {
        toast.error(await getApiErrorMessage(res, "Не удалось обновить шаблон."));
      }
      else router.refresh();
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function archiveTemplate(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/task-templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(
          await getApiErrorMessage(res, "Не удалось архивировать шаблон."),
        );
      }
      else {
        toast.success("Шаблон архивирован");
        router.refresh();
      }
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (response.ok) router.refresh();
      else toast.error(await getApiErrorMessage(response, "Не удалось выйти."));
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function importFile(
    kind: "backup" | "content_pack",
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Файл больше 10 МБ");
      event.target.value = "";
      return;
    }

    setBusy(true);
    try {
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        toast.error("Файл не является корректным JSON");
        return;
      }

      async function send(replace = false) {
        return fetch("/api/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind, replace, data }),
        });
      }

      let response = await send();
      let result: {
        error?: string;
        conflicts?: string[];
        summary?: {
          created: { skills: number; taskTemplates: number; quests: number };
          skipped: { skills: number; taskTemplates: number; quests: number };
        };
      } = await response.json();

      if (
        kind === "backup" &&
        response.status === 409 &&
        result.error === "account_not_empty"
      ) {
        const confirmed = window.confirm(
          "Восстановление экспорта заменит текущие навыки, задачи, квесты и прогресс. Продолжить?",
        );
        if (!confirmed) return;
        response = await send(true);
        result = await response.json();
      }

      if (!response.ok || !result.summary) {
        toast.error("Импорт остановлен", {
          description:
            result.conflicts?.slice(0, 3).join("; ") ??
            "Проверьте формат и версию файла.",
        });
        return;
      }

      const created = result.summary.created;
      const skipped = Object.values(result.summary.skipped).reduce(
        (sum, value) => sum + value,
        0,
      );
      toast.success("Данные импортированы", {
        description: `Навыки: ${created.skills}, повторения: ${created.taskTemplates}, квесты: ${created.quests}${skipped ? ` · без изменений: ${skipped}` : ""}`,
      });
      router.refresh();
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
      event.target.value = "";
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
              disabled={busy}
              onClick={() => changeTheme(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Часовой пояс</h2>
        <div className="flex gap-2">
          <Input
            value={tz}
            list="iana-timezones"
            aria-label="IANA timezone"
            placeholder="Например, Europe/Moscow"
            onChange={(event) => setTz(event.target.value)}
          />
          <Button
            variant="outline"
            disabled={busy || !tz.trim() || tz.trim() === savedTz}
            onClick={changeTimezone}
          >
            Сохранить
          </Button>
        </div>
        <datalist id="iana-timezones">
          {timezoneOptions.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
        <p className="text-xs text-muted-foreground">
          Можно выбрать или ввести любую IANA timezone.
        </p>
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
            <summary className="flex min-h-11 cursor-pointer items-center">
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
        <input
          id="backup-import"
          type="file"
          accept="application/json,.json"
          className="sr-only"
          disabled={busy}
          onChange={(event) => importFile("backup", event)}
        />
        <Button asChild variant="outline" className="w-full">
          <label htmlFor="backup-import">
            <Upload className="size-4" />
            Восстановить из экспорта
          </label>
        </Button>
        <input
          id="content-pack-import"
          type="file"
          accept="application/json,.json"
          className="sr-only"
          disabled={busy}
          onChange={(event) => importFile("content_pack", event)}
        />
        <Button asChild variant="outline" className="w-full">
          <label htmlFor="content-pack-import">
            <Upload className="size-4" />
            Импортировать контент-пак
          </label>
        </Button>
        <p className="text-xs text-muted-foreground">
          Экспорт восстанавливает все данные с заменой. Контент-пак добавляет
          навыки, повторения и квесты без частичного импорта при конфликтах.
        </p>
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
