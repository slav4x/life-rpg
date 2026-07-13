"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { BASE_XP, DIFFICULTIES } from "@/domain/game/constants";
import { cn } from "@/lib/utils";

import type { SkillOption } from "./types";

type Recurrence = "none" | "daily" | "weekdays";

const WEEKDAYS = [
  { iso: 1, label: "Пн" },
  { iso: 2, label: "Вт" },
  { iso: 3, label: "Ср" },
  { iso: 4, label: "Чт" },
  { iso: 5, label: "Пт" },
  { iso: 6, label: "Сб" },
  { iso: 7, label: "Вс" },
];

export function AddActionDrawer({
  date,
  skills,
}: {
  date: string;
  skills: SkillOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [skillId, setSkillId] = useState(skills[0]?.id ?? "");
  const [difficulty, setDifficulty] = useState("normal");
  const [baseXp, setBaseXp] = useState(String(BASE_XP.default));
  const [localDate, setLocalDate] = useState(date);
  const [description, setDescription] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [weekdays, setWeekdays] = useState<number[]>([]);

  function toggleWeekday(iso: number) {
    setWeekdays((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso],
    );
  }

  async function submit() {
    const trimmed = title.trim();
    const xp = Math.round(Number(baseXp));
    if (!trimmed || !skillId) {
      toast.error("Укажите название и навык");
      return;
    }
    if (!Number.isFinite(xp) || xp < 1) {
      toast.error("Некорректное значение XP");
      return;
    }
    if (recurrence === "weekdays" && weekdays.length === 0) {
      toast.error("Выберите дни недели");
      return;
    }

    const isRecurring = recurrence !== "none";
    const url = isRecurring ? "/api/task-templates" : "/api/tasks";
    const body = isRecurring
      ? {
          title: trimmed,
          skillId,
          difficulty,
          baseXp: xp,
          recurrenceType: recurrence,
          weekdays: recurrence === "weekdays" ? weekdays : undefined,
          localDate: date,
          description: description.trim() || undefined,
        }
      : {
          title: trimmed,
          skillId,
          difficulty,
          baseXp: xp,
          localDate,
          description: description.trim() || undefined,
        };

    setSubmitting(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error("Не удалось создать действие");
        return;
      }
      toast.success(isRecurring ? "Повторение создано" : "Действие добавлено");
      setOpen(false);
      setTitle("");
      setDescription("");
      setRecurrence("none");
      setWeekdays([]);
      router.refresh();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Добавить
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>Новое действие</DrawerTitle>
            <DrawerDescription>
              Разовая задача или повторяющееся действие.
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
                <SelectTrigger>
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

            {recurrence === "weekdays" && (
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => toggleWeekday(d.iso)}
                    className={cn(
                      "size-10 rounded-lg border text-sm transition-colors",
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

            {recurrence === "none" && (
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
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Сохранение…" : "Добавить"}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Отмена</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
