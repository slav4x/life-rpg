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
import {
  getApiErrorMessage,
  NETWORK_ERROR_MESSAGE,
} from "@/lib/http/client-error";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { iso: 1, label: "Пн" },
  { iso: 2, label: "Вт" },
  { iso: 3, label: "Ср" },
  { iso: 4, label: "Чт" },
  { iso: 5, label: "Пт" },
  { iso: 6, label: "Сб" },
  { iso: 7, label: "Вс" },
];

export interface TemplateEditVM {
  id: string;
  title: string;
  skillId: string;
  baseXp: number;
  difficulty: string;
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
  const [baseXp, setBaseXp] = useState(String(template.baseXp));
  const [recurrence, setRecurrence] = useState(template.recurrenceType);
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-title">Название</Label>
              <Input
                id="tpl-title"
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Навык</Label>
              <Select value={skillId} onValueChange={setSkillId}>
                <SelectTrigger>
                  <SelectValue />
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
                <Label htmlFor="tpl-xp">Базовый XP</Label>
                <Input
                  id="tpl-xp"
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
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tpl-starts-on">Начало</Label>
                <Input
                  id="tpl-starts-on"
                  type="date"
                  value={startsOn}
                  onChange={(e) => setStartsOn(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tpl-ends-on">Окончание</Label>
                <Input
                  id="tpl-ends-on"
                  type="date"
                  min={startsOn}
                  value={endsOn}
                  onChange={(e) => setEndsOn(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-minutes">Длительность, мин (необязательно)</Label>
              <Input
                id="tpl-minutes"
                type="number"
                inputMode="numeric"
                min={1}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-desc">Описание (необязательно)</Label>
              <Textarea
                id="tpl-desc"
                value={description}
                maxLength={2000}
                rows={2}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
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
