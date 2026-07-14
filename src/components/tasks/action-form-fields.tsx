"use client";

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
import { BASE_XP, DIFFICULTIES, TASK_PRIORITIES } from "@/domain/game/constants";
import { cn } from "@/lib/utils";

export interface ActionSkillOption {
  id: string;
  name: string;
}

export type RecurrenceValue = "none" | "daily" | "weekdays";

const WEEKDAYS = [
  { iso: 1, label: "Пн" },
  { iso: 2, label: "Вт" },
  { iso: 3, label: "Ср" },
  { iso: 4, label: "Чт" },
  { iso: 5, label: "Пт" },
  { iso: 6, label: "Сб" },
  { iso: 7, label: "Вс" },
];

export function ActionCoreFields({
  idPrefix,
  title,
  onTitleChange,
  skills,
  skillId,
  onSkillChange,
  difficulty,
  onDifficultyChange,
  priority,
  onPriorityChange,
  baseXp,
  onBaseXpChange,
  minutes,
  onMinutesChange,
  priorityLabel = "Приоритет",
  previewXp,
}: {
  idPrefix: string;
  title: string;
  onTitleChange: (value: string) => void;
  skills: ActionSkillOption[];
  skillId: string;
  onSkillChange: (value: string) => void;
  difficulty: string;
  onDifficultyChange: (value: string) => void;
  priority: string;
  onPriorityChange: (value: string) => void;
  baseXp: string;
  onBaseXpChange: (value: string) => void;
  minutes: string;
  onMinutesChange: (value: string) => void;
  priorityLabel?: string;
  previewXp?: number;
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-title`}>Название</Label>
        <Input
          id={`${idPrefix}-title`}
          value={title}
          maxLength={200}
          placeholder="Например, тренировка 40 минут"
          onChange={(event) => onTitleChange(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Навык</Label>
        <Select value={skillId} onValueChange={onSkillChange}>
          <SelectTrigger aria-label="Навык">
            <SelectValue placeholder="Выберите навык" />
          </SelectTrigger>
          <SelectContent>
            {skills.map((skill) => (
              <SelectItem key={skill.id} value={skill.id}>
                {skill.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Сложность</Label>
          <Select value={difficulty} onValueChange={onDifficultyChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-xp`}>Базовый XP</Label>
          <Input
            id={`${idPrefix}-xp`}
            type="number"
            inputMode="numeric"
            min={BASE_XP.min}
            max={BASE_XP.max}
            value={baseXp}
            onChange={(event) => onBaseXpChange(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{priorityLabel}</Label>
        <Select value={priority} onValueChange={onPriorityChange}>
          <SelectTrigger aria-label={priorityLabel}>
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

      {previewXp !== undefined && (
        <p className="-mt-2 text-xs text-muted-foreground">
          ≈ {previewXp} XP за выполнение · рекомендуется {BASE_XP.min}–
          {BASE_XP.max}.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-minutes`}>
          Длительность, мин (необязательно)
        </Label>
        <Input
          id={`${idPrefix}-minutes`}
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          value={minutes}
          placeholder="например, 40"
          onChange={(event) => onMinutesChange(event.target.value)}
        />
      </div>

    </>
  );
}

export function ActionDescriptionField({
  idPrefix,
  description,
  onDescriptionChange,
}: {
  idPrefix: string;
  description: string;
  onDescriptionChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${idPrefix}-description`}>Описание (необязательно)</Label>
      <Textarea
        id={`${idPrefix}-description`}
        value={description}
        maxLength={2000}
        rows={2}
        onChange={(event) => onDescriptionChange(event.target.value)}
      />
    </div>
  );
}

export function RecurrenceFields({
  idPrefix,
  recurrence,
  onRecurrenceChange,
  weekdays,
  onToggleWeekday,
  startsOn,
  onStartsOnChange,
  endsOn,
  onEndsOnChange,
  allowNone = false,
}: {
  idPrefix: string;
  recurrence: RecurrenceValue;
  onRecurrenceChange: (value: RecurrenceValue) => void;
  weekdays: number[];
  onToggleWeekday: (iso: number) => void;
  startsOn: string;
  onStartsOnChange: (value: string) => void;
  endsOn: string;
  onEndsOnChange: (value: string) => void;
  allowNone?: boolean;
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label>Повторение</Label>
        <Select
          value={recurrence}
          onValueChange={(value) =>
            onRecurrenceChange(value as RecurrenceValue)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowNone && <SelectItem value="none">Нет</SelectItem>}
            <SelectItem value="daily">Каждый день</SelectItem>
            <SelectItem value="weekdays">По дням недели</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {recurrence === "weekdays" && (
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((day) => (
            <button
              key={day.iso}
              type="button"
              onClick={() => onToggleWeekday(day.iso)}
              className={cn(
                "size-11 rounded-lg border text-sm transition-colors motion-reduce:transition-none",
                weekdays.includes(day.iso)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {day.label}
            </button>
          ))}
        </div>
      )}

      {recurrence !== "none" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-starts-on`}>Начало</Label>
            <Input
              id={`${idPrefix}-starts-on`}
              type="date"
              value={startsOn}
              onChange={(event) => onStartsOnChange(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-ends-on`}>Окончание</Label>
            <Input
              id={`${idPrefix}-ends-on`}
              type="date"
              min={startsOn}
              value={endsOn}
              onChange={(event) => onEndsOnChange(event.target.value)}
            />
          </div>
        </div>
      )}
    </>
  );
}
