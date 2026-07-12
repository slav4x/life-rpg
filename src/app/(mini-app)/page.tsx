import { Sparkles } from "lucide-react";

import { getAuthenticatedUser } from "@/application/auth/session";
import { TelegramLogin } from "@/components/auth/telegram-login";

export default async function TodayPage() {
  const user = await getAuthenticatedUser();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <Sparkles className="size-8 text-primary" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">Life RPG</h1>
        {user ? (
          <p className="max-w-xs text-sm text-muted-foreground">
            Вы вошли как <span className="font-medium">{user.firstName}</span>.
            Игровой цикл появится на следующих этапах.
          </p>
        ) : (
          <p className="max-w-xs text-sm text-muted-foreground">
            Персональный трекер прогресса в стиле RPG.
          </p>
        )}
      </div>

      {!user && <TelegramLogin />}
    </div>
  );
}
