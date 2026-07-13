"use client";

import { Pencil, Plus } from "lucide-react";
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
import {
  ATTRIBUTES,
  SKILL_COLORS,
  SKILL_ICONS,
} from "@/domain/game/constants";
import {
  getApiErrorMessage,
  NETWORK_ERROR_MESSAGE,
} from "@/lib/http/client-error";
import { cn } from "@/lib/utils";

interface EditableSkill {
  id: string;
  name: string;
  description: string | null;
  attributeCode: string;
  icon: string | null;
  color: string | null;
  canChangeAttribute: boolean;
}

export function SkillFormDrawer({
  skill,
}: {
  skill?: EditableSkill;
}) {
  const router = useRouter();
  const isEdit = Boolean(skill);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState(skill?.name ?? "");
  const [attributeCode, setAttributeCode] = useState(
    skill?.attributeCode ?? "body",
  );
  const [description, setDescription] = useState(skill?.description ?? "");
  const [icon, setIcon] = useState(skill?.icon ?? SKILL_ICONS[0]);
  const [color, setColor] = useState(skill?.color ?? SKILL_COLORS[0]);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Укажите название навыка");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        isEdit ? `/api/skills/${skill!.id}` : "/api/skills",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            {
              name: trimmed,
              attributeCode,
              description: description.trim() || (isEdit ? null : undefined),
              icon,
              color,
            },
          ),
        },
      );
      if (!res.ok) {
        toast.error(await getApiErrorMessage(res, "Не удалось сохранить навык."));
        return;
      }
      toast.success(isEdit ? "Навык обновлён" : "Навык создан");
      setOpen(false);
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
        {isEdit ? (
          <Button size="sm" variant="outline">
            <Pencil className="size-4" />
            Изменить
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            Навык
          </Button>
        )}
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>{isEdit ? "Изменить навык" : "Новый навык"}</DrawerTitle>
            <DrawerDescription>
              Навык относится к одной характеристике.
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-4 px-4 pb-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="skill-name">Название</Label>
              <Input
                id="skill-name"
                value={name}
                maxLength={80}
                placeholder="Например, TypeScript"
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Характеристика</Label>
              <Select
                value={attributeCode}
                onValueChange={setAttributeCode}
                disabled={isEdit && !skill?.canChangeAttribute}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTRIBUTES.map((a) => (
                    <SelectItem key={a.code} value={a.code}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isEdit && !skill?.canChangeAttribute && (
                <p className="text-xs text-muted-foreground">
                  После первого начисления XP характеристику изменить нельзя.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Иконка</Label>
              <div className="grid grid-cols-4 gap-2">
                {SKILL_ICONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-label={`Иконка ${option}`}
                    aria-pressed={icon === option}
                    onClick={() => setIcon(option)}
                    className={cn(
                      "flex size-11 items-center justify-center justify-self-center rounded-lg border text-lg transition-colors motion-reduce:transition-none",
                      icon === option
                        ? "border-primary bg-primary/10"
                        : "bg-background",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Цвет</Label>
              <div className="grid grid-cols-4 gap-2">
                {SKILL_COLORS.map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    aria-label={`Цвет ${index + 1}`}
                    aria-pressed={color === option}
                    onClick={() => setColor(option)}
                    className={cn(
                      "size-11 justify-self-center rounded-full border-2 transition-transform motion-reduce:transition-none",
                      color === option
                        ? "scale-90 border-foreground"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: option }}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="skill-desc">Описание (необязательно)</Label>
              <Textarea
                id="skill-desc"
                value={description}
                maxLength={1000}
                rows={2}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <DrawerFooter>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Сохранение…" : isEdit ? "Сохранить" : "Создать"}
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
