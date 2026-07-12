"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { CompleteTaskResult } from "@/application/tasks/complete-task";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DIFFICULTIES } from "@/domain/game/constants";
import { cn } from "@/lib/utils";

import type { TaskVM } from "./types";

const difficultyLabel = (value: string) =>
  DIFFICULTIES.find((d) => d.value === value)?.label ?? value;

export function TaskItem({ task }: { task: TaskVM }) {
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
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="secondary" className="font-normal">
            {task.skillName}
          </Badge>
          <span>+{task.finalXp} XP</span>
          <span>·</span>
          <span>{difficultyLabel(task.difficulty)}</span>
        </span>
      </div>

      {done ? (
        <Check className="size-5 shrink-0 text-primary" aria-label="Выполнено" />
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={complete}
          disabled={loading}
        >
          {loading ? "…" : "Готово"}
        </Button>
      )}
    </li>
  );
}
