"use client";

import { Plus, X } from "lucide-react";
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
import { QUEST_TYPES } from "@/domain/game/quest";

export function CreateQuestDrawer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState("main");
  const [rewardXp, setRewardXp] = useState("250");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<string[]>([""]);

  function updateStep(index: number, value: string) {
    setSteps((prev) => prev.map((s, i) => (i === index ? value : s)));
  }
  function addStep() {
    setSteps((prev) => [...prev, ""]);
  }
  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    const trimmed = title.trim();
    const reward = Math.round(Number(rewardXp));
    const cleanSteps = steps
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => ({ title: s }));
    if (!trimmed) {
      toast.error("Укажите название квеста");
      return;
    }
    if (cleanSteps.length === 0) {
      toast.error("Добавьте хотя бы один шаг");
      return;
    }
    if (!Number.isFinite(reward) || reward < 0) {
      toast.error("Некорректная награда");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/quests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          type,
          rewardXp: reward,
          description: description.trim() || undefined,
          steps: cleanSteps,
        }),
      });
      if (!res.ok) {
        toast.error("Не удалось создать квест");
        return;
      }
      toast.success("Квест создан");
      setOpen(false);
      setTitle("");
      setDescription("");
      setSteps([""]);
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
          Квест
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>Новый квест</DrawerTitle>
            <DrawerDescription>Цель из одного или нескольких шагов.</DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-4 px-4 pb-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quest-title">Название</Label>
              <Input
                id="quest-title"
                value={title}
                maxLength={200}
                placeholder="Например, запустить пет-проект"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Тип</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUEST_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quest-reward">Награда XP</Label>
                <Input
                  id="quest-reward"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={rewardXp}
                  onChange={(e) => setRewardXp(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Шаги</Label>
              <div className="flex flex-col gap-2">
                {steps.map((step, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={step}
                      maxLength={200}
                      placeholder={`Шаг ${index + 1}`}
                      onChange={(e) => updateStep(index, e.target.value)}
                    />
                    {steps.length > 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeStep(index)}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="self-start"
                onClick={addStep}
              >
                <Plus className="size-4" />
                Добавить шаг
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quest-desc">Описание (необязательно)</Label>
              <Textarea
                id="quest-desc"
                value={description}
                maxLength={2000}
                rows={2}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <DrawerFooter>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Сохранение…" : "Создать квест"}
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
