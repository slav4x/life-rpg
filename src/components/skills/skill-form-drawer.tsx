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
import { ATTRIBUTES } from "@/domain/game/constants";

export function SkillFormDrawer({
  skill,
}: {
  skill?: { id: string; name: string; description: string | null };
}) {
  const router = useRouter();
  const isEdit = Boolean(skill);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState(skill?.name ?? "");
  const [attributeCode, setAttributeCode] = useState("body");
  const [description, setDescription] = useState(skill?.description ?? "");

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
            isEdit
              ? { name: trimmed, description: description.trim() || null }
              : {
                  name: trimmed,
                  attributeCode,
                  description: description.trim() || undefined,
                },
          ),
        },
      );
      if (!res.ok) {
        toast.error("Не удалось сохранить навык");
        return;
      }
      toast.success(isEdit ? "Навык обновлён" : "Навык создан");
      setOpen(false);
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

            {!isEdit && (
              <div className="flex flex-col gap-1.5">
                <Label>Характеристика</Label>
                <Select value={attributeCode} onValueChange={setAttributeCode}>
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
              </div>
            )}

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
