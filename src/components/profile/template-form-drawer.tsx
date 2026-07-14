"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  ActionCoreFields,
  ActionDescriptionField,
  RecurrenceFields,
  type RecurrenceValue,
} from "@/components/tasks/action-form-fields";
import {
  getApiErrorMessage,
  NETWORK_ERROR_MESSAGE,
} from "@/lib/http/client-error";

export interface TemplateEditVM {
  id: string;
  title: string;
  skillId: string;
  baseXp: number;
  difficulty: string;
  priority: string;
  description: string | null;
  recurrenceType: string;
  weekdays: number[] | null;
  estimatedMinutes: number | null;
  startsOn: string;
  endsOn: string | null;
}

export function TemplateFormDrawer({
  template,
  skills,
  trigger,
}: {
  template: TemplateEditVM;
  skills: { id: string; name: string }[];
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState(template.title);
  const [skillId, setSkillId] = useState(template.skillId);
  const [difficulty, setDifficulty] = useState(template.difficulty);
  const [priority, setPriority] = useState(template.priority);
  const [baseXp, setBaseXp] = useState(String(template.baseXp));
  const [recurrence, setRecurrence] = useState<RecurrenceValue>(
    template.recurrenceType === "weekdays" ? "weekdays" : "daily",
  );
  const [weekdays, setWeekdays] = useState<number[]>(template.weekdays ?? []);
  const [description, setDescription] = useState(template.description ?? "");
  const [minutes, setMinutes] = useState(
    template.estimatedMinutes ? String(template.estimatedMinutes) : "",
  );
  const [startsOn, setStartsOn] = useState(template.startsOn);
  const [endsOn, setEndsOn] = useState(template.endsOn ?? "");

  function toggleWeekday(iso: number) {
    setWeekdays((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso],
    );
  }

  async function submit() {
    const trimmed = title.trim();
    const xp = Math.round(Number(baseXp));
    const estimatedMinutes = minutes.trim() ? Math.round(Number(minutes)) : null;
    if (!trimmed) {
      toast.error("Укажите название");
      return;
    }
    if (recurrence === "weekdays" && weekdays.length === 0) {
      toast.error("Выберите дни недели");
      return;
    }
    if (endsOn && endsOn < startsOn) {
      toast.error("Дата окончания не может быть раньше даты начала");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/task-templates/${template.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          skillId,
          difficulty,
          priority,
          baseXp: xp,
          recurrenceType: recurrence,
          weekdays: recurrence === "weekdays" ? weekdays : null,
          description: description.trim() || null,
          estimatedMinutes,
          startsOn,
          endsOn: endsOn || null,
        }),
      });
      if (!res.ok) {
        toast.error(
          await getApiErrorMessage(res, "Не удалось сохранить шаблон."),
        );
        return;
      }
      toast.success("Шаблон обновлён");
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
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>Изменить шаблон</DrawerTitle>
          </DrawerHeader>

          <div className="flex flex-col gap-4 px-4 pb-2">
            <ActionCoreFields
              idPrefix="tpl"
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
              priorityLabel="Приоритет задач"
            />

            <RecurrenceFields
              idPrefix="tpl"
              recurrence={recurrence}
              onRecurrenceChange={setRecurrence}
              weekdays={weekdays}
              onToggleWeekday={toggleWeekday}
              startsOn={startsOn}
              onStartsOnChange={setStartsOn}
              endsOn={endsOn}
              onEndsOnChange={setEndsOn}
            />

            <ActionDescriptionField
              idPrefix="tpl"
              description={description}
              onDescriptionChange={setDescription}
            />
          </div>

          <DrawerFooter>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Сохранение…" : "Сохранить"}
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
