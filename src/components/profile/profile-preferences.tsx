"use client";

import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { type Dispatch, type SetStateAction, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getApiErrorMessage,
  NETWORK_ERROR_MESSAGE,
} from "@/lib/http/client-error";

const THEMES = [
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
  { value: "system", label: "Системная" },
];

const FALLBACK_TIMEZONES = [
  "Asia/Novosibirsk",
  "Asia/Yekaterinburg",
  "Asia/Vladivostok",
  "Europe/Moscow",
  "Europe/Kaliningrad",
  "UTC",
];

const TIMEZONES =
  (
    Intl as typeof Intl & {
      supportedValuesOf?: (key: "timeZone") => string[];
    }
  ).supportedValuesOf?.("timeZone") ?? FALLBACK_TIMEZONES;

async function patchProfile(body: Record<string, string>): Promise<Response> {
  return fetch("/api/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function ProfilePreferences({
  timezone,
  busy,
  setBusy,
}: {
  timezone: string;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [tz, setTz] = useState(timezone);
  const [savedTz, setSavedTz] = useState(timezone);
  const timezoneOptions = TIMEZONES.includes(tz) ? TIMEZONES : [tz, ...TIMEZONES];

  async function changeTheme(next: string) {
    const previous = theme ?? "system";
    setTheme(next);
    setBusy(true);
    try {
      const response = await patchProfile({ theme: next });
      if (!response.ok) {
        setTheme(previous);
        toast.error(await getApiErrorMessage(response, "Не удалось сохранить тему."));
      }
    } catch {
      setTheme(previous);
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function changeTimezone() {
    setBusy(true);
    try {
      const response = await patchProfile({ timezone: tz.trim() });
      if (response.ok) {
        setSavedTz(tz.trim());
        setTz(tz.trim());
        toast.success("Часовой пояс обновлён");
        router.refresh();
      } else {
        setTz(savedTz);
        toast.error(
          await getApiErrorMessage(response, "Укажите корректную IANA timezone."),
        );
      }
    } catch {
      setTz(savedTz);
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Тема</h2>
        <div className="flex gap-2">
          {THEMES.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={theme === item.value ? "default" : "outline"}
              disabled={busy}
              onClick={() => changeTheme(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Часовой пояс</h2>
        <div className="flex gap-2">
          <Input
            value={tz}
            list="iana-timezones"
            aria-label="IANA timezone"
            placeholder="Например, Europe/Moscow"
            onChange={(event) => setTz(event.target.value)}
          />
          <Button
            variant="outline"
            disabled={busy || !tz.trim() || tz.trim() === savedTz}
            onClick={changeTimezone}
          >
            Сохранить
          </Button>
        </div>
        <datalist id="iana-timezones">
          {timezoneOptions.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
        <p className="text-xs text-muted-foreground">
          Можно выбрать или ввести любую IANA timezone.
        </p>
      </section>
    </>
  );
}
