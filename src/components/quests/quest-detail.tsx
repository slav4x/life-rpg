"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { CompleteQuestResult } from "@/application/quests/complete-quest";
import type { ToggleStepResult } from "@/application/quests/toggle-step";
import { showAchievementToasts } from "@/components/achievements/achievement-toast";
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

import type { QuestDetailVM, StepVM } from "./types";

const typeLabel = (t: string) =>
  QUEST_TYPES.find((x) => x.value === t)?.label ?? t;

export function QuestDetail({
  quest,
  steps,
}: {
  quest: QuestDetailVM;
  steps: StepVM[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const completedCount = steps.filter((s) => s.completed).length;
  const percent = steps.length
    ? Math.round((completedCount / steps.length) * 100)
    : 0;
  const isCompleted = quest.status === "completed";

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
          <Badge variant="secondary" className="shrink-0 font-normal">
            {typeLabel(quest.type)}
          </Badge>
        </div>
        {quest.description && (
          <p className="text-sm text-muted-foreground">{quest.description}</p>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {completedCount}/{steps.length} шагов
          </span>
          {quest.rewardXp > 0 && <span>Награда: {quest.rewardXp} XP</span>}
        </div>
        {steps.length > 0 && <Progress value={percent} />}
      </header>

      {steps.length > 0 && (
        <ul className="flex flex-col gap-2">
          {steps.map((step) => (
            <li
              key={step.id}
              className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5"
            >
              <Checkbox
                checked={step.completed}
                disabled={busy || isCompleted}
                onCheckedChange={() => toggle(step.id)}
              />
              <span
                className={cn(
                  "flex-1 text-sm",
                  step.completed && "text-muted-foreground line-through",
                )}
              >
                {step.title}
              </span>
              {!step.isRequired && (
                <span className="text-xs text-muted-foreground">необязательный</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {isCompleted ? (
        <p className="text-sm text-muted-foreground">Квест завершён.</p>
      ) : (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={busy}>Завершить квест</Button>
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
