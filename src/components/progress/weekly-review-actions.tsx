"use client";

import { Archive, CalendarClock, ListTodo, Pause, Repeat2, ScrollText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { ProgressData } from "@/application/progress/get-progress";
import { QuestFormDrawer } from "@/components/quests/create-quest-drawer";
import { TemplateFormDrawer } from "@/components/profile/template-form-drawer";
import { TaskFormDrawer } from "@/components/today/task-form-drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getApiErrorMessage,
  NETWORK_ERROR_MESSAGE,
} from "@/lib/http/client-error";
import { addDaysToDate } from "@/lib/dates/local-date";

export function QuestReviewActions({
  quest,
  today,
}: {
  quest: ProgressData["week"]["stalledQuests"][number];
  today: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function update(fields: { dueDate?: string; status?: "archived" }) {
    setBusy(true);
    try {
      const response = await fetch(`/api/quests/${quest.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!response.ok) {
        toast.error(await getApiErrorMessage(response, "Не удалось обновить квест."));
        return;
      }
      toast.success(fields.status === "archived" ? "Квест архивирован" : "Дедлайн обновлён");
      router.refresh();
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <Button asChild size="xs" variant="outline">
        <Link href={`/quests/${quest.id}`}>Открыть</Link>
      </Button>
      <Button
        size="xs"
        variant="outline"
        disabled={busy}
        onClick={() => update({ dueDate: addDaysToDate(today, 7) })}
      >
        <CalendarClock className="size-3.5" />
        {quest.dueDate ? "Сдвинуть на неделю" : "Дедлайн через неделю"}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="xs" variant="ghost" disabled={busy}>
            <Archive className="size-3.5" />
            В архив
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архивировать квест?</AlertDialogTitle>
            <AlertDialogDescription>
              Прогресс сохранится, квест можно будет восстановить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => update({ status: "archived" })}>
              Архивировать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function TemplateReviewActions({
  template,
  skills,
}: {
  template: ProgressData["week"]["problemTemplates"][number];
  skills: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pause() {
    setBusy(true);
    try {
      const response = await fetch(`/api/task-templates/${template.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (!response.ok) {
        toast.error(await getApiErrorMessage(response, "Не удалось поставить повторение на паузу."));
        return;
      }
      toast.success("Повторение поставлено на паузу");
      router.refresh();
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <TemplateFormDrawer
        template={template}
        skills={skills}
        trigger={
          <Button size="xs" variant="outline">
            <Repeat2 className="size-3.5" />
            Изменить частоту
          </Button>
        }
      />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="xs" variant="ghost" disabled={busy}>
            <Pause className="size-3.5" />
            Пауза
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Поставить повторение на паузу?</AlertDialogTitle>
            <AlertDialogDescription>
              Новые задачи создаваться не будут. Повторение можно возобновить в профиле.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={pause}>Поставить на паузу</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function NextWeekPlan({ data }: { data: ProgressData }) {
  const [focus, setFocus] = useState(data.nextWeek.focus);
  const [busy, setBusy] = useState(false);

  async function saveFocus() {
    setBusy(true);
    try {
      const response = await fetch("/api/progress/weekly-focus", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weekStart: data.nextWeek.from, focus }),
      });
      if (!response.ok) {
        toast.error(await getApiErrorMessage(response, "Не удалось сохранить фокус."));
        return;
      }
      toast.success("Фокус следующей недели сохранён");
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={focus}
        maxLength={500}
        rows={3}
        aria-label="Фокус следующей недели"
        placeholder="Главный результат или направление следующей недели"
        onChange={(event) => setFocus(event.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{focus.length}/500</span>
        <Button size="sm" disabled={busy} onClick={saveFocus}>
          {busy ? "Сохранение…" : "Сохранить фокус"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 border-t pt-3">
        <TaskFormDrawer
          date={data.nextWeek.from}
          skills={data.skills}
          trigger={
            <Button size="sm" variant="outline">
              <ListTodo className="size-4" />
              Задача
            </Button>
          }
        />
        <TaskFormDrawer
          date={data.nextWeek.from}
          skills={data.skills}
          initialRecurrence="daily"
          trigger={
            <Button size="sm" variant="outline">
              <Repeat2 className="size-4" />
              Повторение
            </Button>
          }
        />
        <QuestFormDrawer
          attributes={data.questAttributes}
          trigger={
            <Button size="sm" variant="outline">
              <ScrollText className="size-4" />
              Квест
            </Button>
          }
        />
      </div>
    </div>
  );
}
