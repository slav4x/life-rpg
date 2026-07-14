"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type {
  ArchivedSkillOverviewItem,
  AttributeGroup,
} from "@/application/skills/skills-overview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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

import { SkillFormDrawer } from "./skill-form-drawer";

function suggestedRestoredName(name: string): string {
  const suffix = " (восстановлен)";
  return `${name.slice(0, 80 - suffix.length)}${suffix}`;
}

export function SkillsScreen({
  groups,
  archived,
}: {
  groups: AttributeGroup[];
  archived: ArchivedSkillOverviewItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rename, setRename] = useState<{ id: string; value: string } | null>(null);
  const attributeOptions = [
    ...groups.map((group) => ({ code: group.code, name: group.name })),
    ...archived.map((skill) => ({
      code: skill.attributeCode,
      name: skill.attributeName,
    })),
  ].filter(
    (option, index, options) =>
      option.code && options.findIndex((item) => item.code === option.code) === index,
  );
  const query = searchParams.get("q") ?? "";
  const requestedAttribute = searchParams.get("attribute");
  const attribute = attributeOptions.some(
    (option) => option.code === requestedAttribute,
  )
    ? requestedAttribute!
    : "all";
  const listQuery = searchParams.toString();

  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const filteredGroups = groups
    .filter((group) => attribute === "all" || group.code === attribute)
    .map((group) => ({
      ...group,
      skills: group.skills.filter((skill) =>
        skill.name.toLocaleLowerCase("ru-RU").includes(normalizedQuery),
      ),
    }))
    .filter((group) => group.skills.length > 0);
  const filteredArchived = archived.filter(
    (skill) =>
      (attribute === "all" || skill.attributeCode === attribute) &&
      skill.name.toLocaleLowerCase("ru-RU").includes(normalizedQuery),
  );

  function replaceQuery(patch: { q?: string; attribute?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (patch.q !== undefined) {
      if (patch.q) params.set("q", patch.q);
      else params.delete("q");
    }
    if (patch.attribute !== undefined) {
      if (patch.attribute === "all") params.delete("attribute");
      else params.set("attribute", patch.attribute);
    }
    const queryString = params.toString();
    window.history.replaceState(
      null,
      "",
      queryString ? `/skills?${queryString}` : "/skills",
    );
  }

  async function restore(skill: ArchivedSkillOverviewItem, name?: string) {
    setBusyId(skill.id);
    try {
      const response = await fetch(`/api/skills/${skill.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "active",
          ...(name ? { name: name.trim() } : {}),
        }),
      });
      const payload = (await response.clone().json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        if (payload.error === "duplicate_skill") {
          setRename({
            id: skill.id,
            value: name?.trim() || suggestedRestoredName(skill.name),
          });
          toast.error("Название уже занято", {
            description: "Измените название и повторите восстановление.",
          });
        } else {
          toast.error(
            await getApiErrorMessage(response, "Не удалось восстановить навык."),
          );
        }
        return;
      }
      setRename(null);
      toast.success("Навык восстановлен", {
        description: "Его шаблоны остаются в архиве до отдельного восстановления.",
      });
      router.refresh();
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5 py-2">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Навыки</h1>
        <SkillFormDrawer />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Input
          type="search"
          aria-label="Поиск навыков"
          placeholder="Поиск навыков"
          value={query}
          onChange={(event) => replaceQuery({ q: event.target.value })}
        />
        <Select
          value={attribute}
          onValueChange={(value) => replaceQuery({ attribute: value })}
        >
          <SelectTrigger aria-label="Фильтр по характеристике" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            {attributeOptions.map((option) => (
              <SelectItem key={option.code} value={option.code}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {groups.length === 0
            ? "Навыков пока нет. Создайте первый."
            : "По вашему запросу ничего не найдено."}
        </div>
      ) : (
        filteredGroups.map((group) => (
          <section key={group.code} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              {group.name}
            </h2>
            <div className="flex flex-col gap-2">
              {group.skills.map((skill) => (
                <Link
                  key={skill.id}
                  href={`/skills/${skill.id}${listQuery ? `?${listQuery}` : ""}`}
                  className="flex flex-col gap-1.5 rounded-xl border bg-card px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <span
                        aria-hidden="true"
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg border text-base"
                        style={
                          skill.color
                            ? {
                                backgroundColor: `${skill.color}1A`,
                                borderColor: `${skill.color}66`,
                              }
                            : undefined
                        }
                      >
                        {skill.icon ?? "✨"}
                      </span>
                      <span className="truncate">{skill.name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Ур. {skill.level.level} · {skill.xp} XP
                    </span>
                  </div>
                  <Progress value={Math.round(skill.level.ratio * 100)} />
                </Link>
              ))}
            </div>
          </section>
        ))
      )}

      {filteredArchived.length > 0 && (
        <details className="rounded-xl border px-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
            Архив ({filteredArchived.length})
          </summary>
          <div className="flex flex-col gap-2 pb-3">
            {filteredArchived.map((skill) => (
              <div
                key={skill.id}
                data-archived-skill
                className="flex flex-col gap-2 rounded-xl border bg-card px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg border text-base"
                      style={
                        skill.color
                          ? {
                              backgroundColor: `${skill.color}1A`,
                              borderColor: `${skill.color}66`,
                            }
                          : undefined
                      }
                    >
                      {skill.icon ?? "✨"}
                    </span>
                    <span className="truncate">{skill.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {skill.attributeName} · {skill.xp} XP
                  </span>
                </div>
                {rename?.id === skill.id ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-destructive">
                      Активный навык с таким названием уже существует.
                    </p>
                    <Input
                      aria-label={`Новое название для ${skill.name}`}
                      value={rename.value}
                      maxLength={80}
                      onChange={(event) =>
                        setRename({ id: skill.id, value: event.target.value })
                      }
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={busyId === skill.id || !rename.value.trim()}
                        onClick={() => restore(skill, rename.value)}
                      >
                        Переименовать и восстановить
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === skill.id}
                        onClick={() => setRename(null)}
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
                    disabled={busyId === skill.id}
                    onClick={() => restore(skill)}
                  >
                    <RotateCcw className="size-4" />
                    Восстановить
                  </Button>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
