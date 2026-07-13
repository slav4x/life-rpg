"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { showAchievementToasts } from "@/components/achievements/achievement-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  getApiErrorMessage,
  NETWORK_ERROR_MESSAGE,
} from "@/lib/http/client-error";

import type { QuestAttributeOption } from "./types";

interface QuestFormStep {
  key: string;
  id?: string;
  title: string;
  description: string;
  isRequired: boolean;
}

export interface QuestEditVM {
  id: string;
  title: string;
  description: string | null;
  type: string;
  rewardXp: number;
  attributeId: string | null;
  dueDate: string | null;
  manualCompletion: boolean;
  steps: Array<{
    id: string;
    title: string;
    description: string | null;
    isRequired: boolean;
  }>;
}

function initialStep(key: string): QuestFormStep {
  return {
    key,
    title: "",
    description: "",
    isRequired: true,
  };
}

export function QuestFormDrawer({
  attributes,
  quest,
  trigger,
}: {
  attributes: QuestAttributeOption[];
  quest?: QuestEditVM;
  trigger?: ReactNode;
}) {
  const router = useRouter();
  const isEdit = Boolean(quest);
  const nextStepKey = useRef(1);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState(quest?.title ?? "");
  const [type, setType] = useState(quest?.type ?? "main");
  const [rewardXp, setRewardXp] = useState(String(quest?.rewardXp ?? 250));
  const [attributeId, setAttributeId] = useState(quest?.attributeId ?? "none");
  const [dueDate, setDueDate] = useState(quest?.dueDate ?? "");
  const [manualCompletion, setManualCompletion] = useState(
    quest?.manualCompletion ?? true,
  );
  const [description, setDescription] = useState(quest?.description ?? "");
  const [steps, setSteps] = useState<QuestFormStep[]>(
    quest?.steps.map((step) => ({
      key: step.id,
      id: step.id,
      title: step.title,
      description: step.description ?? "",
      isRequired: step.isRequired,
    })) ?? [initialStep("new-0")],
  );

  function updateStep(index: number, patch: Partial<QuestFormStep>) {
    setSteps((current) =>
      current.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...patch } : step,
      ),
    );
  }

  function addStep() {
    if (steps.length >= 30) return;
    setSteps((current) => [
      ...current,
      initialStep(`new-${nextStepKey.current++}`),
    ]);
  }

  function removeStep(index: number) {
    if (steps.length === 1) return;
    setSteps((current) => current.filter((_, stepIndex) => stepIndex !== index));
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    setSteps((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function resetCreateForm() {
    setTitle("");
    setType("main");
    setRewardXp("250");
    setAttributeId("none");
    setDueDate("");
    setManualCompletion(true);
    setDescription("");
    setSteps([initialStep(`new-${nextStepKey.current++}`)]);
  }

  async function submit(createStatus: "draft" | "active" = "active") {
    const cleanTitle = title.trim();
    const reward = Math.round(Number(rewardXp));
    const cleanSteps = steps.map((step) => ({
      ...(step.id ? { id: step.id } : {}),
      title: step.title.trim(),
      description: step.description.trim() || (isEdit ? null : undefined),
      isRequired: step.isRequired,
    }));

    if (!cleanTitle) {
      toast.error("Укажите название квеста");
      return;
    }
    if (cleanSteps.some((step) => !step.title)) {
      toast.error("Укажите название каждого шага");
      return;
    }
    if (!cleanSteps.some((step) => step.isRequired)) {
      toast.error("Нужен хотя бы один обязательный шаг");
      return;
    }
    if (!Number.isFinite(reward) || reward < 0 || reward > 10000) {
      toast.error("Награда должна быть от 0 до 10000 XP");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(isEdit ? `/api/quests/${quest!.id}` : "/api/quests", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          type,
          ...(!isEdit ? { status: createStatus } : {}),
          rewardXp: reward,
          attributeId: attributeId === "none" ? null : attributeId,
          dueDate: dueDate || null,
          manualCompletion,
          description: description.trim() || (isEdit ? null : undefined),
          steps: cleanSteps,
        }),
      });
      if (!res.ok) {
        toast.error(
          await getApiErrorMessage(
            res,
            isEdit ? "Не удалось сохранить квест." : "Не удалось создать квест.",
          ),
        );
        return;
      }
      const result: {
        questCompleted?: {
          rewardXp: number;
          unlockedAchievements: Array<{
            code: string;
            name: string;
            icon: string | null;
          }>;
        } | null;
      } = await res.json();
      if (result.questCompleted) {
        toast.success(`Квест завершён! +${result.questCompleted.rewardXp} XP`);
        showAchievementToasts(result.questCompleted.unlockedAchievements);
      } else {
        toast.success(
          isEdit
            ? "Квест обновлён"
            : createStatus === "draft"
              ? "Черновик сохранён"
              : "Квест создан",
        );
      }
      setOpen(false);
      if (!isEdit) resetCreateForm();
      router.refresh();
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            {isEdit ? <Pencil className="size-4" /> : <Plus className="size-4" />}
            {isEdit ? "Изменить" : "Квест"}
          </Button>
        )}
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>{isEdit ? "Изменить квест" : "Новый квест"}</DrawerTitle>
            <DrawerDescription>
              Цель из обязательных и дополнительных шагов.
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-4 px-4 pb-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quest-title">Название</Label>
              <Input
                id="quest-title"
                value={title}
                maxLength={200}
                placeholder="Например, запустить пет-проект"
                onChange={(event) => setTitle(event.target.value)}
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
                    {QUEST_TYPES.map((questType) => (
                      <SelectItem key={questType.value} value={questType.value}>
                        {questType.label}
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
                  max={10000}
                  value={rewardXp}
                  onChange={(event) => setRewardXp(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Характеристика</Label>
              <Select value={attributeId} onValueChange={setAttributeId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без направления</SelectItem>
                  {attributes.map((attribute) => (
                    <SelectItem key={attribute.id} value={attribute.id}>
                      {attribute.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quest-due-date">Дедлайн</Label>
                <Input
                  id="quest-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Завершение</Label>
                <Select
                  value={manualCompletion ? "manual" : "automatic"}
                  onValueChange={(value) => setManualCompletion(value === "manual")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">С подтверждением</SelectItem>
                    <SelectItem value="automatic">Автоматически</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quest-desc">Описание (необязательно)</Label>
              <Textarea
                id="quest-desc"
                value={description}
                maxLength={2000}
                rows={2}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Шаги</Label>
                <span className="text-xs text-muted-foreground">{steps.length}/30</span>
              </div>
              {steps.map((step, index) => (
                <div
                  key={step.key}
                  className="flex flex-col gap-2 rounded-xl border bg-card p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-xs font-medium text-muted-foreground">
                      Шаг {index + 1}
                    </span>
                    <label className="flex items-center gap-1.5 text-xs">
                      <Checkbox
                        checked={step.isRequired}
                        onCheckedChange={(checked) =>
                          updateStep(index, { isRequired: checked === true })
                        }
                      />
                      Обязательный
                    </label>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Поднять шаг"
                      disabled={index === 0}
                      onClick={() => moveStep(index, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Опустить шаг"
                      disabled={index === steps.length - 1}
                      onClick={() => moveStep(index, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Удалить шаг"
                      disabled={steps.length === 1}
                      onClick={() => removeStep(index)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <Input
                    value={step.title}
                    maxLength={200}
                    placeholder="Название шага"
                    onChange={(event) => updateStep(index, { title: event.target.value })}
                  />
                  <Textarea
                    value={step.description}
                    maxLength={2000}
                    rows={2}
                    placeholder="Описание шага (необязательно)"
                    onChange={(event) =>
                      updateStep(index, { description: event.target.value })
                    }
                  />
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="self-start"
                disabled={steps.length >= 30}
                onClick={addStep}
              >
                <Plus className="size-4" />
                Добавить шаг
              </Button>
            </div>
          </div>

          <DrawerFooter>
            {isEdit ? (
              <Button onClick={() => submit()} disabled={submitting}>
                {submitting ? "Сохранение…" : "Сохранить"}
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => submit("draft")}
                  disabled={submitting}
                >
                  В черновики
                </Button>
                <Button onClick={() => submit("active")} disabled={submitting}>
                  {submitting ? "Сохранение…" : "Создать квест"}
                </Button>
              </div>
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

export function CreateQuestDrawer({
  attributes,
}: {
  attributes: QuestAttributeOption[];
}) {
  return <QuestFormDrawer attributes={attributes} />;
}
