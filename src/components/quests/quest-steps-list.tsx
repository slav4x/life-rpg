"use client";

import { CalendarPlus } from "lucide-react";

import { TaskFormDrawer } from "@/components/today/task-form-drawer";
import type { SkillOption } from "@/components/today/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import type { StepVM } from "./types";

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("ru-RU").format(new Date(`${date}T00:00:00`));
}

export function QuestStepsList({
  steps,
  skills,
  today,
  defaultSkillId,
  busy,
  active,
  onToggle,
}: {
  steps: StepVM[];
  skills: SkillOption[];
  today: string;
  defaultSkillId?: string;
  busy: boolean;
  active: boolean;
  onToggle: (stepId: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {steps.map((step) => (
        <li
          key={step.id}
          className="flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5"
        >
          <Checkbox
            className="mt-0.5"
            checked={step.completed}
            disabled={busy || !active}
            onCheckedChange={() => onToggle(step.id)}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "flex-1 text-sm",
                  step.completed && "text-muted-foreground line-through",
                )}
              >
                {step.title}
              </span>
              {!step.isRequired && (
                <Badge variant="outline" className="font-normal">
                  необязательный
                </Badge>
              )}
            </div>
            {step.description && (
              <p className="text-xs text-muted-foreground">{step.description}</p>
            )}
            {step.task ? (
              <p className="text-xs text-muted-foreground">
                Задача на {formatDate(step.task.localDate)} ·{" "}
                {step.task.status === "completed" ? "выполнена" : "в работе"}
              </p>
            ) : (
              active &&
              !step.completed &&
              skills.length > 0 && (
                <TaskFormDrawer
                  date={today}
                  skills={skills}
                  preset={{
                    title: step.title,
                    description: step.description,
                    questStepId: step.id,
                    skillId: defaultSkillId,
                  }}
                  trigger={
                    <Button size="sm" variant="outline" className="self-start">
                      <CalendarPlus className="size-4" />
                      Добавить в задачи
                    </Button>
                  }
                />
              )
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
