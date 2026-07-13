"use client";

import { CalendarClock, Pause, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { PlanningSummary } from "@/application/tasks/planning";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  getApiErrorMessage,
  NETWORK_ERROR_MESSAGE,
} from "@/lib/http/client-error";

type OverdueTask = PlanningSummary["overdueTasks"][number];

interface PendingDismiss {
  taskIds: string[];
  scope: "this" | "future";
  title: string;
  description: string;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

const priorityLabel: Record<string, string> = {
  high: "Высокий",
  normal: "Обычный",
  low: "Низкий",
};

export function OverdueTasksPanel({
  tasks,
  today,
}: {
  tasks: OverdueTask[];
  today: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetDate, setTargetDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [pendingDismiss, setPendingDismiss] =
    useState<PendingDismiss | null>(null);

  const selectedIds = tasks
    .filter((task) => selected.has(task.id))
    .map((task) => task.id);
  const allSelected = tasks.length > 0 && selectedIds.length === tasks.length;

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function clearResolved(ids: string[]) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });
  }

  async function request(body: Record<string, unknown>, fallback: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/tasks/overdue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        toast.error(await getApiErrorMessage(response, fallback));
        return false;
      }
      return true;
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function reschedule(taskIds: string[], date: string) {
    if (taskIds.length === 0) return;
    const ok = await request(
      { action: "reschedule", taskIds, targetDate: date },
      "Не удалось перенести задачи.",
    );
    if (!ok) return;
    clearResolved(taskIds);
    toast.success(
      taskIds.length === 1
        ? `Задача перенесена на ${formatDate(date)}`
        : `Перенесено задач: ${taskIds.length}`,
      {
        description:
          "Пропущенные повторения становятся разовыми задачами и не меняют будущую серию.",
      },
    );
    router.refresh();
  }

  async function dismiss(action: PendingDismiss) {
    const ok = await request(
      { action: "dismiss", taskIds: action.taskIds, scope: action.scope },
      "Не удалось разобрать задачи.",
    );
    if (!ok) return;
    clearResolved(action.taskIds);
    setPendingDismiss(null);
    toast.success(
      action.scope === "future"
        ? "Повторение поставлено на паузу"
        : action.taskIds.length === 1
          ? "Задача убрана"
          : `Разобрано задач: ${action.taskIds.length}`,
    );
    router.refresh();
  }

  return (
    <section
      id="overdue"
      className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Просроченные задачи</h3>
          <p className="text-xs text-muted-foreground">
            {tasks.length} · можно перенести или убрать независимо от возраста
          </p>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            aria-label="Выбрать все просроченные задачи"
            checked={allSelected}
            onCheckedChange={(checked) =>
              setSelected(
                checked === true
                  ? new Set(tasks.map((task) => task.id))
                  : new Set(),
              )
            }
          />
          Все
        </label>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border bg-background p-2.5">
          <span className="text-xs font-medium">Выбрано: {selectedIds.length}</span>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Input
              type="date"
              min={today}
              value={targetDate}
              aria-label="Новая дата для выбранных задач"
              onChange={(event) => setTargetDate(event.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !targetDate || targetDate < today}
              onClick={() => reschedule(selectedIds, targetDate)}
            >
              Перенести
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="self-start text-destructive"
            disabled={busy}
            onClick={() =>
              setPendingDismiss({
                taskIds: selectedIds,
                scope: "this",
                title: `Убрать выбранные задачи (${selectedIds.length})?`,
                description:
                  "Экземпляры повторений будут пропущены, разовые задачи удалены. Будущие повторения продолжат работать.",
              })
            }
          >
            <Trash2 className="size-4" />
            Пропустить / удалить
          </Button>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            data-overdue-task
            className="flex flex-col gap-2 rounded-lg border bg-background px-3 py-2.5"
          >
            <div className="flex items-start gap-3">
              <Checkbox
                className="mt-0.5"
                aria-label={`Выбрать задачу ${task.title}`}
                checked={selected.has(task.id)}
                onCheckedChange={(checked) => toggle(task.id, checked === true)}
              />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {task.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{formatDate(task.localDate)}</span>
                  <Badge variant="secondary" className="font-normal">
                    {task.skillName}
                  </Badge>
                  <Badge variant="outline" className="font-normal">
                    {task.templateId ? "Повторение" : "Разовая"}
                  </Badge>
                  {task.priority !== "normal" && (
                    <Badge variant={task.priority === "high" ? "default" : "outline"}>
                      {priorityLabel[task.priority] ?? task.priority}
                    </Badge>
                  )}
                  {task.estimatedMinutes != null && (
                    <span>~{task.estimatedMinutes} мин</span>
                  )}
                  {task.tooOldToComplete && (
                    <Badge variant="outline" className="text-destructive">
                      Старше 7 дней
                    </Badge>
                  )}
                  {task.questStepId && <Badge variant="outline">Шаг квеста</Badge>}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 pl-8">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => reschedule([task.id], today)}
              >
                <CalendarClock className="size-4" />
                На сегодня
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  setPendingDismiss({
                    taskIds: [task.id],
                    scope: "this",
                    title: task.templateId
                      ? "Пропустить это повторение?"
                      : "Удалить просроченную задачу?",
                    description: task.templateId
                      ? "Будущие экземпляры повторения продолжат создаваться по расписанию."
                      : "Разовая задача будет удалена без начисления XP.",
                  })
                }
              >
                {task.templateId ? "Пропустить эту" : "Удалить"}
              </Button>
              {task.templateId && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  disabled={busy}
                  onClick={() =>
                    setPendingDismiss({
                      taskIds: [task.id],
                      scope: "future",
                      title: "Пропустить и поставить повторение на паузу?",
                      description:
                        "Эта и все уже созданные будущие pending-задачи шаблона будут отменены. Завершённые записи и история не изменятся.",
                    })
                  }
                >
                  <Pause className="size-4" />
                  Эта и будущие
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog
        open={pendingDismiss !== null}
        onOpenChange={(open) => !open && setPendingDismiss(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingDismiss?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDismiss?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => pendingDismiss && dismiss(pendingDismiss)}
            >
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
