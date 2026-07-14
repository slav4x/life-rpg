"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ActionCoreFields,
  ActionDescriptionField,
  RecurrenceFields,
  type RecurrenceValue,
} from "@/components/tasks/action-form-fields";
import { calculateFinalXp } from "@/domain/game/calculate-xp";
import { BASE_XP, isDifficulty } from "@/domain/game/constants";
import {
  getApiErrorMessage,
  NETWORK_ERROR_MESSAGE,
} from "@/lib/http/client-error";

import type { SkillOption } from "./types";

export interface TaskEditVM {
  id: string;
  title: string;
  description: string | null;
  skillId: string;
  difficulty: string;
  priority: string;
  baseXp: number;
  localDate: string;
  estimatedMinutes: number | null;
  templateId: string | null;
}

export interface TaskPreset {
  title: string;
  description?: string | null;
  questStepId: string;
  skillId?: string;
}

export function TaskFormDrawer({
  date,
  skills,
  task,
  preset,
  trigger,
  initialRecurrence = "none",
}: {
  date: string;
  skills: SkillOption[];
  task?: TaskEditVM;
  preset?: TaskPreset;
  trigger?: ReactNode;
  initialRecurrence?: RecurrenceValue;
}) {
  const router = useRouter();
  const isEdit = Boolean(task);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState(task?.title ?? preset?.title ?? "");
  const [skillId, setSkillId] = useState(
    task?.skillId ?? preset?.skillId ?? skills[0]?.id ?? "",
  );
  const [difficulty, setDifficulty] = useState(task?.difficulty ?? "normal");
  const [priority, setPriority] = useState(task?.priority ?? "normal");
  const [baseXp, setBaseXp] = useState(String(task?.baseXp ?? BASE_XP.default));
  const [minutes, setMinutes] = useState(
    task?.estimatedMinutes ? String(task.estimatedMinutes) : "",
  );
  const [localDate, setLocalDate] = useState(task?.localDate ?? date);
  const [endsOn, setEndsOn] = useState("");
  const [description, setDescription] = useState(
    task?.description ?? preset?.description ?? "",
  );
  const [recurrence, setRecurrence] =
    useState<RecurrenceValue>(initialRecurrence);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [scope, setScope] = useState<"this" | "future">("this");

  const xpNumber = Math.round(Number(baseXp));
  const previewXp =
    Number.isFinite(xpNumber) && isDifficulty(difficulty)
      ? calculateFinalXp(xpNumber, difficulty)
      : 0;

  function toggleWeekday(iso: number) {
    setWeekdays((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso],
    );
  }

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || !skillId) {
      toast.error("Укажите название и навык");
      return;
    }
    if (!Number.isFinite(xpNumber) || xpNumber < BASE_XP.min) {
      toast.error(`Базовый XP от ${BASE_XP.min} до ${BASE_XP.max}`);
      return;
    }
    if (recurrence !== "none" && endsOn && endsOn < localDate) {
      toast.error("Дата окончания не может быть раньше даты начала");
      return;
    }
    const estimatedMinutes = minutes.trim() ? Math.round(Number(minutes)) : null;

    setBusy(true);
    try {
      let res: Response;
      if (isEdit) {
        res = await fetch(`/api/tasks/${task!.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: trimmed,
            skillId,
            difficulty,
            priority,
            baseXp: xpNumber,
            localDate,
            description: description.trim() || null,
            estimatedMinutes,
            scope: task!.templateId ? scope : undefined,
          }),
        });
      } else if (!preset && recurrence !== "none") {
        if (recurrence === "weekdays" && weekdays.length === 0) {
          toast.error("Выберите дни недели");
          setBusy(false);
          return;
        }
        res = await fetch("/api/task-templates", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: trimmed,
            skillId,
            difficulty,
            priority,
            baseXp: xpNumber,
            recurrenceType: recurrence,
            weekdays: recurrence === "weekdays" ? weekdays : undefined,
            localDate,
            endsOn: endsOn || undefined,
            description: description.trim() || undefined,
            estimatedMinutes: estimatedMinutes ?? undefined,
          }),
        });
      } else {
        res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: trimmed,
            skillId,
            difficulty,
            priority,
            baseXp: xpNumber,
            localDate,
            description: description.trim() || undefined,
            estimatedMinutes: estimatedMinutes ?? undefined,
            questStepId: preset?.questStepId,
          }),
        });
      }

      if (!res.ok) {
        toast.error(
          await getApiErrorMessage(
            res,
            isEdit ? "Не удалось сохранить действие." : "Не удалось создать действие.",
          ),
        );
        return;
      }
      toast.success(isEdit ? "Сохранено" : "Готово");
      setOpen(false);
      if (!isEdit) {
        setTitle("");
        setDescription("");
        setRecurrence(initialRecurrence);
        setWeekdays([]);
        setEndsOn("");
      }
      router.refresh();
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task!.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(await getApiErrorMessage(res, "Не удалось удалить действие."));
        return;
      }
      toast.success("Действие удалено");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" />
            Добавить
          </Button>
        )}
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>{isEdit ? "Изменить действие" : "Новое действие"}</DrawerTitle>
            <DrawerDescription>
              {isEdit
                ? "Отредактируйте параметры действия."
                : "Разовая задача или повторяющееся действие."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-4 px-4 pb-2">
            <ActionCoreFields
              idPrefix="task"
              title={title}
              onTitleChange={setTitle}
              skills={skills}
              skillId={skillId}
              onSkillChange={setSkillId}
              difficulty={difficulty}
              onDifficultyChange={setDifficulty}
              priority={priority}
              onPriorityChange={setPriority}
              baseXp={baseXp}
              onBaseXpChange={setBaseXp}
              minutes={minutes}
              onMinutesChange={setMinutes}
              previewXp={previewXp}
            />

            {!isEdit && !preset && (
              <RecurrenceFields
                idPrefix="task"
                recurrence={recurrence}
                onRecurrenceChange={setRecurrence}
                weekdays={weekdays}
                onToggleWeekday={toggleWeekday}
                startsOn={localDate}
                onStartsOnChange={setLocalDate}
                endsOn={endsOn}
                onEndsOnChange={setEndsOn}
                allowNone
              />
            )}

            {(isEdit || recurrence === "none") && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-date">Дата</Label>
                <Input
                  id="task-date"
                  type="date"
                  value={localDate}
                  onChange={(e) => setLocalDate(e.target.value)}
                />
              </div>
            )}

            {isEdit && task!.templateId && (
              <div className="flex flex-col gap-1.5">
                <Label>Применить к</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={scope === "this" ? "default" : "outline"}
                    onClick={() => setScope("this")}
                  >
                    Только эту
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={scope === "future" ? "default" : "outline"}
                    onClick={() => setScope("future")}
                  >
                    Эту и будущие
                  </Button>
                </div>
              </div>
            )}

            <ActionDescriptionField
              idPrefix="task"
              description={description}
              onDescriptionChange={setDescription}
            />
          </div>

          <DrawerFooter>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Сохранение…" : isEdit ? "Сохранить" : "Добавить"}
            </Button>
            {isEdit && (
              <Button
                variant="ghost"
                className="text-destructive"
                disabled={busy}
                onClick={remove}
              >
                Удалить действие
              </Button>
            )}
            <DrawerClose asChild>
              <Button variant="outline">Отмена</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
