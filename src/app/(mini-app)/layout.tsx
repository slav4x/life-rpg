import type { ReactNode } from "react";

import { getAuthenticatedUser } from "@/application/auth/session";
import { BottomNav } from "@/components/layout/bottom-nav";

/**
 * Shell for the Telegram Mini App screens. Constrains content to a mobile
 * column, reserves the Telegram safe-area insets, and shows the bottom
 * navigation once the user is authenticated (SPEC §6.1).
 */
export default async function MiniAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getAuthenticatedUser();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <main className="flex flex-1 flex-col px-4 pt-4 pb-4">{children}</main>
      {user && <BottomNav />}
    </div>
  );
}
