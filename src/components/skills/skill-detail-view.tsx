"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { SkillDetail } from "@/application/skills/skill-detail";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getApiErrorMessage,
  NETWORK_ERROR_MESSAGE,
} from "@/lib/http/client-error";

import { SkillFormDrawer } from "./skill-form-drawer";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function SkillDetailView({ detail }: { detail: SkillDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/skills");
  }

  async function archive() {
    setBusy(true);
    try {
      const res = await fetch(`/api/skills/${detail.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(
          await getApiErrorMessage(res, "Не удалось архивировать навык."),
        );
        return;
      }
      toast.success("Навык архивирован");
      router.push("/skills");
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 py-2">
      <Button
        type="button"
        variant="ghost"
        className="-ml-3 self-start text-muted-foreground"
        onClick={goBack}
      >
        <ArrowLeft className="size-4" />
        Навыки
      </Button>

      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border text-xl"
              style={
                detail.color
                  ? {
                      backgroundColor: `${detail.color}1A`,
                      borderColor: `${detail.color}66`,
                    }
                  : undefined
              }
            >
              {detail.icon ?? "✨"}
            </span>
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {detail.name}
            </h1>
          </div>
          <Badge variant="secondary" className="shrink-0 font-normal">
            {detail.attributeName}
          </Badge>
        </div>
        {detail.description && (
          <p className="text-sm text-muted-foreground">{detail.description}</p>
        )}
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">
              Уровень {detail.level.level}
            </span>
            <span className="text-xs text-muted-foreground">
              {detail.level.xpIntoLevel} / {detail.level.xpForNextLevel} XP
            </span>
          </div>
          <Progress
            value={Math.round(detail.level.ratio * 100)}
            className="mt-2"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Всего: {detail.xp} XP
          </p>
        </div>

        <div className="flex gap-2">
          <SkillFormDrawer
            skill={{
              id: detail.id,
              name: detail.name,
              description: detail.description,
              attributeCode: detail.attributeCode,
              icon: detail.icon,
              color: detail.color,
              canChangeAttribute: detail.canChangeAttribute,
            }}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" disabled={busy}>
                Архивировать
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Архивировать навык?</AlertDialogTitle>
                <AlertDialogDescription>
                  Навык скроется из списков, но история XP сохранится.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={archive}>
                  Архивировать
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">История XP</h2>
        {detail.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет начислений.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {detail.history.map((entry, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">
                  {formatDate(entry.createdAt)}
                </span>
                <span className={entry.amount < 0 ? "text-destructive" : ""}>
                  {entry.amount > 0 ? "+" : ""}
                  {entry.amount} XP
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detail.recentTasks.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Связанные действия</h2>
          <ul className="flex flex-col gap-1.5">
            {detail.recentTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm"
              >
                <span className="truncate">{task.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {task.status === "completed" ? "выполнено" : "в работе"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
