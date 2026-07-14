"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getApiErrorMessage,
  NETWORK_ERROR_MESSAGE,
} from "@/lib/http/client-error";

export function ProfileSession({
  busy,
  setBusy,
}: {
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
}) {
  const router = useRouter();

  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (response.ok) router.refresh();
      else toast.error(await getApiErrorMessage(response, "Не удалось выйти."));
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="ghost"
      className="text-destructive"
      onClick={logout}
      disabled={busy}
    >
      <LogOut className="size-4" />
      Выйти
    </Button>
  );
}
