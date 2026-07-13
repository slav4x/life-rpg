"use client";

import { Archive, ArrowLeft, CalendarPlus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { CompleteQuestResult } from "@/application/quests/complete-quest";
import type { ToggleStepResult } from "@/application/quests/toggle-step";
import { showAchievementToasts } from "@/components/achievements/achievement-toast";
import { TaskFormDrawer } from "@/components/today/task-form-drawer";
import type { SkillOption } from "@/components/today/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { QUEST_TYPES } from "@/domain/game/quest";
import { cn } from "@/lib/utils";

import { QuestFormDrawer } from "./create-quest-drawer";
import type { QuestAttributeOption, QuestDetailVM, StepVM } from "./types";

const typeLabel = (type: string) =>
  QUEST_TYPES.find((item) => item.value === type)?.label ?? type;

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("ru-RU").format(new Date(`${date}T00:00:00`));
}

export function QuestDetail({
  quest,
  steps,
  attributes,
  skills,
  today,
}: {
  quest: QuestDetailVM;
  steps: StepVM[];
  attributes: QuestAttributeOption[];
  skills: SkillOption[];
  today: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const completedCount = steps.filter((step) => step.completed).length;
  const requiredSteps = steps.filter((step) => step.isRequired);
  const progressSteps = requiredSteps.length > 0 ? requiredSteps : steps;
  const progressCompleted = progressSteps.filter((step) => step.completed).length;
  const percent = progressSteps.length
    ? Math.round((progressCompleted / progressSteps.length) * 100)
    : 0;
  const allRequiredDone = requiredSteps.every((step) => step.completed);
  const isActive = quest.status === "active";
  const isCompleted = quest.status === "completed";
  const isArchived = quest.status === "archived";
  const defaultSkill = quest.attributeId
    ? skills.find((skill) => skill.attributeId === quest.attributeId)
    : undefined;

  async function toggle(stepId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/quest-steps/${stepId}/toggle`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Не удалось обновить шаг");
        return;
      }
      const data: ToggleStepResult = await res.json();
      if (data.questCompleted) {
        toast.success(`Квест завершён! +${data.questCompleted.rewardXp} XP`);
        showAchievementToasts(data.questCompleted.unlockedAchievements);
      }
      router.refresh();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/quests/${quest.id}/complete`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Не удалось завершить квест");
        return;
      }
      const data: CompleteQuestResult = await res.json();
      toast.success(`Квест завершён! +${data.rewardXp} XP`, {
        description: data.levelUp ? `Новый уровень: ${data.levelUp.to}!` : undefined,
      });
      showAchievementToasts(data.unlockedAchievements);
      router.refresh();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: "active" | "archived") {
    setBusy(true);
    try {
      const res = await fetch(`/api/quests/${quest.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error(status === "archived" ? "Не удалось архивировать" : "Не удалось вернуть квест");
        return;
      }
      toast.success(status === "archived" ? "Квест архивирован" : "Квест возвращён");
      router.refresh();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 py-2">
      <Link
        href="/quests"
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
        Квесты
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{quest.title}</h1>
          <div className="flex flex-wrap justify-end gap-1">
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
        {quest.description && (
          <p className="text-sm text-muted-foreground">{quest.description}</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {requiredSteps.length > 0
              ? `${progressCompleted}/${requiredSteps.length} обязательных`
              : `${completedCount}/${steps.length} шагов`}
          </span>
          <span>{quest.manualCompletion ? "С подтверждением" : "Автозавершение"}</span>
          {quest.rewardXp > 0 && <span>Награда: {quest.rewardXp} XP</span>}
        </div>
        {quest.dueDate && (
          <p className="text-xs text-muted-foreground">
            Дедлайн: {formatDate(quest.dueDate)}
          </p>
        )}
        {steps.length > 0 && <Progress value={percent} />}

        {(isActive || quest.status === "draft") && (
          <div className="flex flex-wrap gap-2">
            <QuestFormDrawer
              attributes={attributes}
              quest={{
                id: quest.id,
                title: quest.title,
                description: quest.description,
                type: quest.type,
                rewardXp: quest.rewardXp,
                attributeId: quest.attributeId,
                dueDate: quest.dueDate,
                manualCompletion: quest.manualCompletion,
                steps: steps.map((step) => ({
                  id: step.id,
                  title: step.title,
                  description: step.description,
                  isRequired: step.isRequired,
                })),
              }}
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" disabled={busy}>
                  <Archive className="size-4" />
                  Архивировать
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Архивировать квест?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Квест и его прогресс сохранятся. Его можно будет вернуть из архива.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={() => changeStatus("archived")}>
                    Архивировать
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {isArchived && (
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            disabled={busy}
            onClick={() => changeStatus("active")}
          >
            <RotateCcw className="size-4" />
            Вернуть в активные
          </Button>
        )}
      </header>

      <ul className="flex flex-col gap-2">
        {steps.map((step) => (
          <li
            key={step.id}
            className="flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5"
          >
            <Checkbox
              className="mt-0.5"
              checked={step.completed}
              disabled={busy || !isActive}
              onCheckedChange={() => toggle(step.id)}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "flex-1 text-sm",
                    step.completed && "text-muted-foreground line-through",
                  )}
                >
                  {step.title}
                </span>
                {!step.isRequired && (
                  <Badge variant="outline" className="font-normal">
                    необязательный
                  </Badge>
                )}
              </div>
              {step.description && (
                <p className="text-xs text-muted-foreground">{step.description}</p>
              )}
              {step.task ? (
                <p className="text-xs text-muted-foreground">
                  Задача на {formatDate(step.task.localDate)} ·{" "}
                  {step.task.status === "completed" ? "выполнена" : "в работе"}
                </p>
              ) : (
                isActive &&
                !step.completed &&
                skills.length > 0 && (
                  <TaskFormDrawer
                    date={today}
                    skills={skills}
                    preset={{
                      title: step.title,
                      description: step.description,
                      questStepId: step.id,
                      skillId: defaultSkill?.id,
                    }}
                    trigger={
                      <Button size="sm" variant="outline" className="self-start">
                        <CalendarPlus className="size-4" />
                        Добавить в задачи
                      </Button>
                    }
                  />
                )
              )}
            </div>
          </li>
        ))}
      </ul>

      {isCompleted ? (
        <p className="text-sm text-muted-foreground">Квест завершён.</p>
      ) : isArchived ? (
        <p className="text-sm text-muted-foreground">Квест находится в архиве.</p>
      ) : !quest.manualCompletion ? (
        <p className="text-sm text-muted-foreground">
          Квест завершится автоматически после выполнения обязательных шагов.
        </p>
      ) : (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={busy || !isActive || !allRequiredDone}>
              {allRequiredDone
                ? "Завершить квест"
                : "Выполните обязательные шаги"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Завершить квест?</AlertDialogTitle>
              <AlertDialogDescription>
                Вы получите награду {quest.rewardXp} XP. Это действие подтверждает
                завершение квеста.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={complete}>Завершить</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
