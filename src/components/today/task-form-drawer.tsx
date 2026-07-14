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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { calculateFinalXp } from "@/domain/game/calculate-xp";
import {
  BASE_XP,
  DIFFICULTIES,
  isDifficulty,
  TASK_PRIORITIES,
} from "@/domain/game/constants";
import {
  getApiErrorMessage,
  NETWORK_ERROR_MESSAGE,
} from "@/lib/http/client-error";
import { cn } from "@/lib/utils";

import type { SkillOption } from "./types";

type Recurrence = "none" | "daily" | "weekdays";

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

const WEEKDAYS = [
  { iso: 1, label: "Пн" },
  { iso: 2, label: "Вт" },
  { iso: 3, label: "Ср" },
  { iso: 4, label: "Чт" },
  { iso: 5, label: "Пт" },
  { iso: 6, label: "Сб" },
  { iso: 7, label: "Вс" },
];

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
  initialRecurrence?: Recurrence;
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
  const [recurrence, setRecurrence] = useState<Recurrence>(initialRecurrence);
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-title">Название</Label>
              <Input
                id="task-title"
                value={title}
                maxLength={200}
                placeholder="Например, тренировка 40 минут"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Навык</Label>
              <Select value={skillId} onValueChange={setSkillId}>
                <SelectTrigger aria-label="Навык">
                  <SelectValue placeholder="Выберите навык" />
                </SelectTrigger>
                <SelectContent>
                  {skills.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Сложность</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="task-xp">Базовый XP</Label>
                <Input
                  id="task-xp"
                  type="number"
                  inputMode="numeric"
                  min={BASE_XP.min}
                  max={BASE_XP.max}
                  value={baseXp}
                  onChange={(e) => setBaseXp(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Приоритет</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger aria-label="Приоритет">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              ≈ {previewXp} XP за выполнение · рекомендуется {BASE_XP.min}–{BASE_XP.max}.
            </p>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-min">Длительность, мин (необязательно)</Label>
              <Input
                id="task-min"
                type="number"
                inputMode="numeric"
                min={1}
                max={1440}
                value={minutes}
                placeholder="например, 40"
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>

            {!isEdit && !preset && (
              <div className="flex flex-col gap-1.5">
                <Label>Повторение</Label>
                <Select
                  value={recurrence}
                  onValueChange={(v) => setRecurrence(v as Recurrence)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Нет</SelectItem>
                    <SelectItem value="daily">Каждый день</SelectItem>
                    <SelectItem value="weekdays">По дням недели</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {!isEdit && !preset && recurrence === "weekdays" && (
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => toggleWeekday(d.iso)}
                    className={cn(
                      "size-11 rounded-lg border text-sm transition-colors motion-reduce:transition-none",
                      weekdays.includes(d.iso)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}

            {!isEdit && !preset && recurrence !== "none" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="task-starts-on">Начало</Label>
                  <Input
                    id="task-starts-on"
                    type="date"
                    value={localDate}
                    onChange={(e) => setLocalDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="task-ends-on">Окончание</Label>
                  <Input
                    id="task-ends-on"
                    type="date"
                    min={localDate}
                    value={endsOn}
                    onChange={(e) => setEndsOn(e.target.value)}
                  />
                </div>
              </div>
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-desc">Описание (необязательно)</Label>
              <Textarea
                id="task-desc"
                value={description}
                maxLength={2000}
                rows={2}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
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
