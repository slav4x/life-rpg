"use client";

/** Minimal typings for the parts of the Telegram WebApp SDK we rely on. */
interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand?: () => void;
  colorScheme?: "light" | "dark";
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** Raw, unverified `initData` string, or null when not running in Telegram. */
export function getTelegramInitData(): string | null {
  if (typeof window === "undefined") return null;
  const initData = window.Telegram?.WebApp?.initData;
  return initData && initData.length > 0 ? initData : null;
}

/** Signal to Telegram that the Mini App is ready to be shown. */
export function telegramReady(): void {
  if (typeof window === "undefined") return;
  window.Telegram?.WebApp?.ready?.();
}
