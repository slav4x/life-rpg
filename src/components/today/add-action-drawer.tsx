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

import type { SkillOption } from "./types";

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

    setSubmitting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          skillId,
          difficulty,
          baseXp: xp,
          localDate,
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        toast.error("Не удалось создать действие");
        return;
      }
      toast.success("Действие добавлено");
      setOpen(false);
      setTitle("");
      setDescription("");
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
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader>
            <DrawerTitle>Новое действие</DrawerTitle>
            <DrawerDescription>Разовая задача на выбранную дату.</DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-4 px-4">
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
            <p className="-mt-2 text-xs text-muted-foreground">
              Рекомендуется {BASE_XP.min}–{BASE_XP.max} XP.
            </p>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-date">Дата</Label>
              <Input
                id="task-date"
                type="date"
                value={localDate}
                onChange={(e) => setLocalDate(e.target.value)}
              />
            </div>

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
              {submitting ? "Сохранение…" : "Добавить действие"}
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
