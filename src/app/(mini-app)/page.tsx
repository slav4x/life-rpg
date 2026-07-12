import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function TodayPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <Sparkles className="size-8 text-primary" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">Life RPG</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Фундамент проекта готов. Игровой цикл и экран «Сегодня» появятся на
          следующих этапах.
        </p>
      </div>
      <Button disabled>Скоро: экран «Сегодня»</Button>
    </div>
  );
}
