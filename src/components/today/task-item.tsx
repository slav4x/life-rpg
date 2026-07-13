"use client";

import { Check, Flame, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { CompleteTaskResult } from "@/application/tasks/complete-task";
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
import { DIFFICULTIES } from "@/domain/game/constants";
import { cn } from "@/lib/utils";

import { TaskFormDrawer } from "./task-form-drawer";
import type { SkillOption, TaskVM } from "./types";

const difficultyLabel = (value: string) =>
  DIFFICULTIES.find((d) => d.value === value)?.label ?? value;

export function TaskItem({
  task,
  date,
  skills,
}: {
  task: TaskVM;
  date: string;
  skills: SkillOption[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const done = task.status !== "pending";

  async function complete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/complete`, {
        method: "POST",
        headers: { "idempotency-key": crypto.randomUUID() },
      });
      if (!res.ok) {
        toast.error("Не удалось завершить задачу");
        return;
      }
      const result: CompleteTaskResult = await res.json();
      toast.success(`+${result.xp.global} XP`, {
        description: (
          <span className="flex flex-col gap-0.5">
            <span>
              Навык «{result.skill.name}»: +{result.xp.skill} XP
            </span>
            <span>
              {result.attribute.name}: +{result.xp.attribute} XP
            </span>
            {result.streak && result.streak.current > 1 && (
              <span>Серия: {result.streak.current} 🔥</span>
            )}
            {result.levelUp && (
              <span className="font-medium text-foreground">
                Новый уровень: {result.levelUp.to}!
              </span>
            )}
            {result.skill.leveledUp && (
              <span className="font-medium text-foreground">
                Навык «{result.skill.name}» вырос до уровня {result.skill.level}!
              </span>
            )}
          </span>
        ),
      });
      showAchievementToasts(result.unlockedAchievements);
      if (result.questCompleted) {
        toast.success(`Квест завершён! +${result.questCompleted.rewardXp} XP`);
        showAchievementToasts(result.questCompleted.unlockedAchievements);
      }
      router.refresh();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  async function revert() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/revert`, { method: "POST" });
      if (!res.ok) {
        toast.error("Не удалось отменить");
        return;
      }
      toast.success("Выполнение отменено");
      router.refresh();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            "truncate text-sm font-medium",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </span>
        {task.description && (
          <span className="truncate text-xs text-muted-foreground">
            {task.description}
          </span>
        )}
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="secondary" className="font-normal">
            {task.skillName}
          </Badge>
          <span>+{task.finalXp} XP</span>
          <span>·</span>
          <span>{difficultyLabel(task.difficulty)}</span>
          {task.estimatedMinutes != null && (
            <>
              <span>·</span>
              <span>~{task.estimatedMinutes} мин</span>
            </>
          )}
          {task.questStepId && <Badge variant="outline">Шаг квеста</Badge>}
          {task.streak != null && task.streak > 0 && (
            <span className="inline-flex items-center gap-0.5 text-foreground">
              <Flame className="size-3" />
              {task.streak}
            </span>
          )}
        </span>
      </div>

      {done ? (
        <div className="flex shrink-0 items-center gap-1">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                disabled={loading}
              >
                Отменить
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Отменить выполнение?</AlertDialogTitle>
                <AlertDialogDescription>
                  Начисленный XP будет списан, а серия пересчитана. Уже открытые
                  достижения останутся полученными.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Назад</AlertDialogCancel>
                <AlertDialogAction onClick={revert}>
                  Отменить выполнение
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Check className="size-5 text-primary" aria-label="Выполнено" />
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          <TaskFormDrawer
            date={date}
            skills={skills}
            task={{
              id: task.id,
              title: task.title,
              description: task.description,
              skillId: task.skillId,
              difficulty: task.difficulty,
              baseXp: task.baseXp,
              localDate: date,
              estimatedMinutes: task.estimatedMinutes,
              templateId: task.templateId,
            }}
            trigger={
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground"
                aria-label="Изменить"
              >
                <Pencil className="size-4" />
              </Button>
            }
          />
          <Button
            size="sm"
            variant="outline"
            onClick={complete}
            disabled={loading}
          >
            {loading ? "…" : "Готово"}
          </Button>
        </div>
      )}
    </li>
  );
}
