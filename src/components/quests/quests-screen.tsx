"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QUEST_TYPES } from "@/domain/game/quest";

import { CreateQuestDrawer } from "./create-quest-drawer";
import type { QuestAttributeOption, QuestVM } from "./types";

const typeLabel = (t: string) =>
  QUEST_TYPES.find((x) => x.value === t)?.label ?? t;

function QuestCard({ quest }: { quest: QuestVM }) {
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
        <span className="text-xs text-muted-foreground">
          До {new Intl.DateTimeFormat("ru-RU").format(new Date(`${quest.dueDate}T00:00:00`))}
        </span>
      )}
      {quest.total > 0 && <Progress value={quest.percent} />}
    </Link>
  );
}

function QuestList({ items, empty }: { items: QuestVM[]; empty: string }) {
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
        <QuestCard key={quest.id} quest={quest} />
      ))}
    </div>
  );
}

export function QuestsScreen({
  quests,
  attributes,
}: {
  quests: QuestVM[];
  attributes: QuestAttributeOption[];
}) {
  const active = quests.filter(
    (q) => q.status === "active" || q.status === "draft",
  );
  const completed = quests.filter((q) => q.status === "completed");
  const archived = quests.filter((q) => q.status === "archived");

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Квесты</h1>
        <CreateQuestDrawer attributes={attributes} />
      </div>

      <Tabs defaultValue="active">
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
          <QuestList items={active} empty="Нет активных квестов." />
        </TabsContent>
        <TabsContent value="completed" className="mt-3">
          <QuestList items={completed} empty="Пока ничего не завершено." />
        </TabsContent>
        <TabsContent value="archived" className="mt-3">
          <QuestList items={archived} empty="Архив пуст." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
