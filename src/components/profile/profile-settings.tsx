"use client";

import { Download, LogOut, Pencil, RotateCcw, Upload } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useState } from "react";
import { toast } from "sonner";

import type {
  ProfileSkillOption,
  ProfileTemplate,
} from "@/application/profile/get-profile";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

type ImportSection = "skills" | "tasks" | "taskTemplates" | "quests";
type ImportCounts = Record<ImportSection, number>;
type ImportSelection = Record<ImportSection, boolean>;

interface ContentPackPreview {
  formatVersion: 1 | 2;
  name: string;
  anchorDate: string;
  selection: ImportSelection;
  summary: {
    created: ImportCounts;
    skipped: ImportCounts;
    rejected: ImportCounts;
  };
  conflicts: string[];
}

interface PendingContentPack {
  data: unknown;
  preview: ContentPackPreview;
}

const IMPORT_SECTIONS: Array<{ key: ImportSection; label: string }> = [
  { key: "skills", label: "Навыки" },
  { key: "tasks", label: "Разовые задачи" },
  { key: "taskTemplates", label: "Повторения" },
  { key: "quests", label: "Квесты" },
];

const ALL_IMPORT_SECTIONS: ImportSelection = {
  skills: true,
  tasks: true,
  taskTemplates: true,
  quests: true,
};

function scheduleLabel(t: ProfileTemplate): string {
  const recurrence =
    t.recurrenceType === "daily"
      ? "Каждый день"
      : (t.weekdays ?? [])
          .slice()
          .sort((a, b) => a - b)
          .map((d) => DAY_LABELS[d])
          .join(", ");
  return `${recurrence} · с ${t.startsOn}${t.endsOn ? ` до ${t.endsOn}` : ""}`;
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
  const [templateRename, setTemplateRename] = useState<{
    id: string;
    value: string;
  } | null>(null);
  const [pendingContentPack, setPendingContentPack] =
    useState<PendingContentPack | null>(null);

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

  async function restoreTemplate(template: ProfileTemplate, title?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/task-templates/${template.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          isActive: true,
          ...(title ? { title: title.trim() } : {}),
        }),
      });
      const payload = (await res.clone().json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        if (payload.error === "duplicate_template") {
          const suffix = " (восстановлен)";
          setTemplateRename({
            id: template.id,
            value:
              title?.trim() ||
              `${template.title.slice(0, 200 - suffix.length)}${suffix}`,
          });
          toast.error("Название шаблона уже занято", {
            description: "Измените название и повторите восстановление.",
          });
        } else {
          toast.error(
            await getApiErrorMessage(res, "Не удалось восстановить шаблон."),
          );
        }
        return;
      }
      setTemplateRename(null);
      toast.success("Шаблон восстановлен и активирован");
      router.refresh();
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

  function importDescription(created: ImportCounts, skipped: ImportCounts) {
    const skippedTotal = Object.values(skipped).reduce(
      (sum, value) => sum + value,
      0,
    );
    return `Навыки: ${created.skills}, задачи: ${created.tasks}, повторения: ${created.taskTemplates}, квесты: ${created.quests}${skippedTotal ? ` · без изменений: ${skippedTotal}` : ""}`;
  }

  async function requestContentPackPreview(
    data: unknown,
    selection: ImportSelection,
    anchorDate?: string,
  ): Promise<ContentPackPreview | null> {
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "content_pack",
        mode: "preview",
        data,
        selection,
        anchorDate,
      }),
    });
    const result = (await response.json()) as {
      error?: string;
      conflicts?: string[];
      preview?: ContentPackPreview;
    };
    if (!response.ok || !result.preview) {
      toast.error("Предпросмотр не создан", {
        description:
          result.conflicts?.slice(0, 3).join("; ") ??
          "Проверьте формат и версию файла.",
      });
      return null;
    }
    return result.preview;
  }

  async function changeContentPackSelection(
    section: ImportSection,
    checked: boolean,
  ) {
    if (!pendingContentPack) return;
    const selection = {
      ...pendingContentPack.preview.selection,
      [section]: checked,
    };
    setBusy(true);
    try {
      const preview = await requestContentPackPreview(
        pendingContentPack.data,
        selection,
        pendingContentPack.preview.anchorDate,
      );
      if (preview) {
        setPendingContentPack({ data: pendingContentPack.data, preview });
      }
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function confirmContentPackImport() {
    if (!pendingContentPack) return;
    setBusy(true);
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "content_pack",
          mode: "commit",
          data: pendingContentPack.data,
          selection: pendingContentPack.preview.selection,
          anchorDate: pendingContentPack.preview.anchorDate,
        }),
      });
      const result = (await response.json()) as {
        conflicts?: string[];
        summary?: { created: ImportCounts; skipped: ImportCounts };
      };
      if (!response.ok || !result.summary) {
        toast.error("Импорт остановлен", {
          description:
            result.conflicts?.slice(0, 3).join("; ") ??
            "Данные изменились после предпросмотра. Обновите его и повторите.",
        });
        return;
      }
      toast.success("Данные импортированы", {
        description: importDescription(result.summary.created, result.summary.skipped),
      });
      setPendingContentPack(null);
      router.refresh();
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

      if (kind === "content_pack") {
        const preview = await requestContentPackPreview(
          data,
          ALL_IMPORT_SECTIONS,
        );
        if (preview) setPendingContentPack({ data, preview });
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
          created: ImportCounts;
          skipped: ImportCounts;
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

      toast.success("Данные импортированы", {
        description: importDescription(
          result.summary.created,
          result.summary.skipped,
        ),
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
          <details className="rounded-xl border px-3 text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center font-medium">
              Архив ({archived.length})
            </summary>
            <ul className="flex flex-col gap-2 pb-3">
              {archived.map((t) => (
                <li
                  key={t.id}
                  data-archived-template
                  className="flex flex-col gap-2 rounded-xl border bg-card px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-medium">{t.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {scheduleLabel(t)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Навык: {t.skillName}
                  </p>
                  {t.skillArchived ? (
                    <p className="text-xs text-muted-foreground">
                      Сначала восстановите связанный навык в разделе «Навыки».
                    </p>
                  ) : templateRename?.id === t.id ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-destructive">
                        Неархивный шаблон с таким названием уже существует.
                      </p>
                      <Input
                        aria-label={`Новое название шаблона ${t.title}`}
                        value={templateRename.value}
                        maxLength={200}
                        onChange={(event) =>
                          setTemplateRename({ id: t.id, value: event.target.value })
                        }
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={busy || !templateRename.value.trim()}
                          onClick={() => restoreTemplate(t, templateRename.value)}
                        >
                          Переименовать и восстановить
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setTemplateRename(null)}
                        >
                          Отмена
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="self-start"
                      disabled={busy}
                      onClick={() => restoreTemplate(t)}
                    >
                      <RotateCcw className="size-4" />
                      Восстановить
                    </Button>
                  )}
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
        {pendingContentPack && (
          <div
            data-content-pack-preview
            className="flex flex-col gap-3 rounded-xl border bg-card p-3"
          >
            <div>
              <h3 className="text-sm font-medium">
                {pendingContentPack.preview.name} · v
                {pendingContentPack.preview.formatVersion}
              </h3>
              <p className="text-xs text-muted-foreground">
                Относительные даты рассчитаны от {pendingContentPack.preview.anchorDate}.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {IMPORT_SECTIONS.map((section) => (
                <label
                  key={section.key}
                  className="flex min-h-11 items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={pendingContentPack.preview.selection[section.key]}
                    disabled={busy}
                    onCheckedChange={(checked) =>
                      changeContentPackSelection(section.key, checked === true)
                    }
                  />
                  {section.label}
                </label>
              ))}
            </div>
            <div className="flex flex-col gap-1 text-xs">
              {IMPORT_SECTIONS.map((section) => (
                <div
                  key={section.key}
                  className="flex items-center justify-between gap-2"
                >
                  <span>{section.label}</span>
                  <span className="text-muted-foreground">
                    создать {pendingContentPack.preview.summary.created[section.key]} ·
                    пропустить {pendingContentPack.preview.summary.skipped[section.key]} ·
                    отклонить {pendingContentPack.preview.summary.rejected[section.key]}
                  </span>
                </div>
              ))}
            </div>
            {pendingContentPack.preview.conflicts.length > 0 && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2">
                <p className="text-xs font-medium text-destructive">
                  Импорт нельзя подтвердить:
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {pendingContentPack.preview.conflicts.slice(0, 5).map((conflict) => (
                    <li key={conflict}>{conflict}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={
                  busy ||
                  pendingContentPack.preview.conflicts.length > 0 ||
                  !Object.values(pendingContentPack.preview.selection).some(Boolean)
                }
                onClick={confirmContentPackImport}
              >
                Подтвердить импорт
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setPendingContentPack(null)}
              >
                Отмена
              </Button>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Экспорт восстанавливает все данные с заменой. Контент-пак сначала показывает
          предпросмотр, затем атомарно добавляет выбранные разделы.
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
