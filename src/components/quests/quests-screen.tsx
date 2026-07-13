"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isQuestType, QUEST_TYPES } from "@/domain/game/quest";
import { cn } from "@/lib/utils";

import { CreateQuestDrawer } from "./create-quest-drawer";
import type { QuestAttributeOption, QuestVM } from "./types";

const typeLabel = (t: string) =>
  QUEST_TYPES.find((x) => x.value === t)?.label ?? t;

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("ru-RU").format(new Date(`${date}T00:00:00`));
}

function QuestCard({ quest, today }: { quest: QuestVM; today: string }) {
  const overdue = quest.status === "active" && Boolean(quest.dueDate) && quest.dueDate! < today;

  return (
    <Link
      href={`/quests/${quest.id}`}
      className="flex flex-col gap-2 rounded-xl border bg-card px-3 py-3"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium">{quest.title}</span>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {quest.attributeName && (
            <Badge variant="outline" className="font-normal">
              {quest.attributeName}
            </Badge>
          )}
          <Badge variant="secondary" className="font-normal">
            {typeLabel(quest.type)}
          </Badge>
          {quest.status === "draft" && (
            <Badge variant="outline" className="font-normal">
              Черновик
            </Badge>
          )}
          {quest.status === "archived" && quest.completedAt && (
            <Badge variant="outline" className="font-normal">
              Завершён
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {quest.requiredTotal > 0
            ? `${quest.requiredCompleted}/${quest.requiredTotal} обязательных`
            : `${quest.completed}/${quest.total} шагов`}
        </span>
        {quest.rewardXp > 0 && <span>Награда: {quest.rewardXp} XP</span>}
      </div>
      {quest.dueDate && (
        <span
          className={cn(
            "text-xs text-muted-foreground",
            overdue && "font-medium text-destructive",
          )}
        >
          {overdue ? "Просрочен · " : "До "}
          {formatDate(quest.dueDate)}
        </span>
      )}
      {quest.total > 0 && <Progress value={quest.percent} />}
    </Link>
  );
}

function QuestList({
  items,
  empty,
  today,
}: {
  items: QuestVM[];
  empty: string;
  today: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((quest) => (
        <QuestCard key={quest.id} quest={quest} today={today} />
      ))}
    </div>
  );
}

export function QuestsScreen({
  quests,
  attributes,
  today,
}: {
  quests: QuestVM[];
  attributes: QuestAttributeOption[];
  today: string;
}) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const urlTab =
    requestedTab === "completed" || requestedTab === "archived"
      ? requestedTab
      : "active";
  const requestedType = searchParams.get("type");
  const urlType = requestedType && isQuestType(requestedType) ? requestedType : "all";
  const activeTab = urlTab;
  const typeFilter = urlType;
  const [query, setQuery] = useState("");
  const [attributeFilter, setAttributeFilter] = useState("all");
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");

  const filtered = quests.filter(
    (quest) =>
      (typeFilter === "all" || quest.type === typeFilter) &&
      (attributeFilter === "all" || quest.attributeName === attributeFilter) &&
      `${quest.title} ${quest.attributeName ?? ""}`
        .toLocaleLowerCase("ru-RU")
        .includes(normalizedQuery),
  );
  const active = filtered
    .filter((quest) => quest.status === "active" || quest.status === "draft")
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === "draft" ? 1 : -1;
      if (left.dueDate && right.dueDate) return left.dueDate.localeCompare(right.dueDate);
      if (left.dueDate) return -1;
      if (right.dueDate) return 1;
      return left.title.localeCompare(right.title, "ru");
    });
  const completed = filtered.filter((quest) => quest.status === "completed");
  const archived = filtered.filter((quest) => quest.status === "archived");

  function replaceQuery(patch: { tab?: string; type?: string }) {
    const params = new URLSearchParams(window.location.search);
    if (patch.tab) params.set("tab", patch.tab);
    else if (!params.has("tab")) params.set("tab", activeTab);
    if (patch.type === "all") params.delete("type");
    else if (patch.type) params.set("type", patch.type);
    window.history.replaceState(null, "", `/quests?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Квесты</h1>
        <CreateQuestDrawer attributes={attributes} />
      </div>

      <Input
        type="search"
        aria-label="Поиск квестов"
        placeholder="Поиск квестов"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="grid grid-cols-2 gap-2">
        <Select
          value={typeFilter}
          onValueChange={(value) => replaceQuery({ type: value })}
        >
          <SelectTrigger id="quest-type-filter" aria-label="Фильтр по типу квеста">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            {QUEST_TYPES.map((questType) => (
              <SelectItem key={questType.value} value={questType.value}>
                {questType.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={attributeFilter} onValueChange={setAttributeFilter}>
          <SelectTrigger aria-label="Фильтр квестов по характеристике">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все направления</SelectItem>
            {attributes.map((attribute) => (
              <SelectItem key={attribute.id} value={attribute.name}>
                {attribute.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => replaceQuery({ tab: value })}
      >
        <TabsList className="w-full">
          <TabsTrigger value="active" className="flex-1">
            Активные
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">
            Завершённые
          </TabsTrigger>
          <TabsTrigger value="archived" className="flex-1">
            Архив
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-3">
          <QuestList items={active} empty="Нет активных квестов этого типа." today={today} />
        </TabsContent>
        <TabsContent value="completed" className="mt-3">
          <QuestList items={completed} empty="Пока ничего не завершено." today={today} />
        </TabsContent>
        <TabsContent value="archived" className="mt-3">
          <QuestList items={archived} empty="Архив пуст." today={today} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
