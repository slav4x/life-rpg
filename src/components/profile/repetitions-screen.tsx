"use client";

import { ArrowLeft, Pencil, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type {
  RepetitionSkillOption,
  RepetitionTemplate,
} from "@/application/templates/get-repetitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getApiErrorMessage,
  NETWORK_ERROR_MESSAGE,
} from "@/lib/http/client-error";

import { TemplateFormDrawer } from "./template-form-drawer";

const DAY_LABELS = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function scheduleLabel(template: RepetitionTemplate): string {
  const recurrence =
    template.recurrenceType === "daily"
      ? "Каждый день"
      : (template.weekdays ?? [])
          .slice()
          .sort((left, right) => left - right)
          .map((day) => DAY_LABELS[day])
          .join(", ");
  return `${recurrence} · с ${template.startsOn}${template.endsOn ? ` до ${template.endsOn}` : ""}`;
}

export function RepetitionsScreen({
  templates,
  skills,
}: {
  templates: RepetitionTemplate[];
  skills: RepetitionSkillOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [templateRename, setTemplateRename] = useState<{
    id: string;
    value: string;
  } | null>(null);

  const skillOptions = templates
    .map((template) => ({ id: template.skillId, name: template.skillName }))
    .filter(
      (option, index, options) =>
        options.findIndex((item) => item.id === option.id) === index,
    );
  const requestedSkill = searchParams.get("skill");
  const selectedSkill = skillOptions.some((skill) => skill.id === requestedSkill)
    ? requestedSkill!
    : "all";
  const query = searchParams.get("q") ?? "";
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const matchesTemplate = (template: RepetitionTemplate) =>
    (selectedSkill === "all" || template.skillId === selectedSkill) &&
    `${template.title} ${template.skillName}`
      .toLocaleLowerCase("ru-RU")
      .includes(normalizedQuery);
  const active = templates.filter(
    (template) => !template.archived && matchesTemplate(template),
  );
  const archived = templates.filter(
    (template) => template.archived && matchesTemplate(template),
  );
  const hasTemplates = templates.length > 0;

  function replaceQuery(patch: { q?: string; skill?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    const queryString = params.toString();
    window.history.replaceState(
      null,
      "",
      queryString ? `/repetitions?${queryString}` : "/repetitions",
    );
  }

  async function patchTemplate(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch(`/api/task-templates/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        toast.error(
          await getApiErrorMessage(response, "Не удалось обновить повторение."),
        );
        return;
      }
      router.refresh();
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function archiveTemplate(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/task-templates/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error(
          await getApiErrorMessage(response, "Не удалось архивировать повторение."),
        );
        return;
      }
      toast.success("Повторение архивировано");
      router.refresh();
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function restoreTemplate(
    template: RepetitionTemplate,
    title?: string,
  ) {
    setBusy(true);
    try {
      const response = await fetch(`/api/task-templates/${template.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          isActive: true,
          ...(title ? { title: title.trim() } : {}),
        }),
      });
      const payload = (await response.clone().json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        if (payload.error === "duplicate_template") {
          const suffix = " (восстановлен)";
          setTemplateRename({
            id: template.id,
            value:
              title?.trim() ||
              `${template.title.slice(0, 200 - suffix.length)}${suffix}`,
          });
          toast.error("Название повторения уже занято", {
            description: "Измените название и повторите восстановление.",
          });
        } else {
          toast.error(
            await getApiErrorMessage(response, "Не удалось восстановить повторение."),
          );
        }
        return;
      }
      setTemplateRename(null);
      toast.success("Повторение восстановлено и активировано");
      router.refresh();
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 py-2">
      <Button
        asChild
        type="button"
        variant="ghost"
        className="-ml-3 self-start text-muted-foreground"
      >
        <Link href="/profile">
          <ArrowLeft className="size-4" />
          Профиль
        </Link>
      </Button>

      <header>
        <h1 className="text-xl font-semibold tracking-tight">Повторения</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Расписание, пауза и архив повторяющихся действий.
        </p>
      </header>

      {hasTemplates && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Input
            type="search"
            aria-label="Поиск повторений"
            placeholder="Поиск повторений"
            value={query}
            onChange={(event) => replaceQuery({ q: event.target.value })}
          />
          <Select
            value={selectedSkill}
            onValueChange={(value) => replaceQuery({ skill: value })}
          >
            <SelectTrigger aria-label="Фильтр повторений по навыку" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все навыки</SelectItem>
              {skillOptions.map((skill) => (
                <SelectItem key={skill.id} value={skill.id}>
                  {skill.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Активные и на паузе</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {hasTemplates && (query.trim() || selectedSkill !== "all")
              ? "Повторений по вашему запросу нет."
              : "Повторений пока нет."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((template) => (
              <li
                key={template.id}
                className="flex flex-col gap-2 rounded-xl border bg-card px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{template.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Навык: {template.skillName}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    {scheduleLabel(template)}
                    {!template.isActive && " · пауза"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <TemplateFormDrawer
                    template={template}
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
                      patchTemplate(template.id, {
                        isActive: !template.isActive,
                      })
                    }
                  >
                    {template.isActive ? "Пауза" : "Возобновить"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    disabled={busy}
                    onClick={() => archiveTemplate(template.id)}
                  >
                    Архив
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {archived.length > 0 && (
        <details className="rounded-xl border px-3 text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">
            Архив ({archived.length})
          </summary>
          <ul className="flex flex-col gap-2 pb-3">
            {archived.map((template) => (
              <li
                key={template.id}
                data-archived-template
                className="flex flex-col gap-2 rounded-xl border bg-card px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {template.title}
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    {scheduleLabel(template)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Навык: {template.skillName}
                </p>
                {template.skillArchived ? (
                  <p className="text-xs text-muted-foreground">
                    Сначала восстановите связанный навык в разделе «Навыки».
                  </p>
                ) : templateRename?.id === template.id ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-destructive">
                      Неархивное повторение с таким названием уже существует.
                    </p>
                    <Input
                      aria-label={`Новое название повторения ${template.title}`}
                      value={templateRename.value}
                      maxLength={200}
                      onChange={(event) =>
                        setTemplateRename({
                          id: template.id,
                          value: event.target.value,
                        })
                      }
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={busy || !templateRename.value.trim()}
                        onClick={() =>
                          restoreTemplate(template, templateRename.value)
                        }
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
                    onClick={() => restoreTemplate(template)}
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
    </div>
  );
}
