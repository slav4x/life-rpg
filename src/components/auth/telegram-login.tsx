"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getTelegramInitData, telegramReady } from "@/lib/telegram/web-app";

type LoginState =
  | "checking"
  | "authenticating"
  | "unavailable"
  | "forbidden"
  | "error";

const MESSAGES: Record<Exclude<LoginState, "checking">, string> = {
  authenticating: "Проверяем вход через Telegram…",
  unavailable: "Откройте приложение внутри Telegram, чтобы войти.",
  forbidden: "Доступ ограничён: этот Telegram-аккаунт не в списке разрешённых.",
  error: "Не удалось войти. Попробуйте переоткрыть приложение.",
};

/**
 * Client-side login trigger: reads Telegram `initData` and exchanges it for a
 * server session. On success it refreshes the server components so the
 * authenticated view renders. All verification happens on the server.
 */
export function TelegramLogin() {
  const router = useRouter();
  const [state, setState] = useState<LoginState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      telegramReady();
      const initData = getTelegramInitData();

      if (!initData) {
        // Outside Telegram: fall back to the dev bypass. The endpoint returns
        // 404 unless DEV_AUTH_BYPASS is enabled on a non-production server.
        try {
          const res = await fetch("/api/auth/dev-login", { method: "POST" });
          if (cancelled) return;
          if (res.ok) {
            router.refresh();
            return;
          }
        } catch {
          // ignore and fall through to the "unavailable" message
        }
        if (!cancelled) setState("unavailable");
        return;
      }

      if (!cancelled) setState("authenticating");
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        if (cancelled) return;
        if (res.ok) {
          router.refresh();
          return;
        }
        setState(res.status === 403 ? "forbidden" : "error");
      } catch {
        if (!cancelled) setState("error");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const message =
    state === "checking" ? MESSAGES.authenticating : MESSAGES[state];

  return (
    <p className="max-w-xs text-sm text-muted-foreground" role="status">
      {message}
    </p>
  );
}
