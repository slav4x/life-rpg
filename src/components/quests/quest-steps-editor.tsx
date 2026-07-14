"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface QuestFormStep {
  key: string;
  id?: string;
  title: string;
  description: string;
  isRequired: boolean;
}

export function QuestStepsEditor({
  steps,
  onUpdate,
  onMove,
  onRemove,
  onAdd,
}: {
  steps: QuestFormStep[];
  onUpdate: (index: number, patch: Partial<QuestFormStep>) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  return (
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
                  onUpdate(index, { isRequired: checked === true })
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
              onClick={() => onMove(index, -1)}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Опустить шаг"
              disabled={index === steps.length - 1}
              onClick={() => onMove(index, 1)}
            >
              <ArrowDown className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Удалить шаг"
              disabled={steps.length === 1}
              onClick={() => onRemove(index)}
            >
              <X className="size-4" />
            </Button>
          </div>
          <Input
            value={step.title}
            maxLength={200}
            placeholder="Название шага"
            onChange={(event) => onUpdate(index, { title: event.target.value })}
          />
          <Textarea
            value={step.description}
            maxLength={2000}
            rows={2}
            placeholder="Описание шага (необязательно)"
            onChange={(event) =>
              onUpdate(index, { description: event.target.value })
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
        onClick={onAdd}
      >
        <Plus className="size-4" />
        Добавить шаг
      </Button>
    </div>
  );
}
