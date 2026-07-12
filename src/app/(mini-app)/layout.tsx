import type { ReactNode } from "react";

/**
 * Shell for the Telegram Mini App screens. Constrains content to a mobile
 * column and reserves the Telegram safe-area insets at the bottom (SPEC §6.1).
 * The bottom navigation and per-screen chrome arrive in later stages.
 */
export default function MiniAppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <main className="flex flex-1 flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}
