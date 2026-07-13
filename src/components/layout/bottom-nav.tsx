"use client";

import { BarChart3, CalendarCheck, ScrollText, Sparkles, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { isValidDateString } from "@/lib/dates/local-date";
import { cn } from "@/lib/utils";

const SELECTED_DATE_KEY = "life-rpg:selected-date";

const subscribeToSelectedDate = () => () => {};

function getStoredSelectedDate(): string | null {
  const value = sessionStorage.getItem(SELECTED_DATE_KEY);
  return value && isValidDateString(value) ? value : null;
}

const ITEMS = [
  { href: "/", label: "Сегодня", icon: CalendarCheck, enabled: true },
  { href: "/quests", label: "Квесты", icon: ScrollText, enabled: true },
  { href: "/skills", label: "Навыки", icon: Sparkles, enabled: true },
  { href: "/progress", label: "Прогресс", icon: BarChart3, enabled: true },
  { href: "/profile", label: "Профиль", icon: User, enabled: true },
];

export function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryDate = searchParams.get("date");
  const validQueryDate =
    queryDate && isValidDateString(queryDate) ? queryDate : null;
  const storedDate = useSyncExternalStore(
    subscribeToSelectedDate,
    getStoredSelectedDate,
    () => null,
  );

  useEffect(() => {
    if (validQueryDate) {
      sessionStorage.setItem(SELECTED_DATE_KEY, validQueryDate);
    } else if (pathname === "/") {
      sessionStorage.removeItem(SELECTED_DATE_KEY);
    }
  }, [pathname, validQueryDate]);

  const selectedDate =
    validQueryDate ?? (pathname === "/" ? null : storedDate);

  return (
    <nav className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const inner = (
            <span
              className={cn(
                "flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 text-[11px]",
                active ? "text-foreground" : "text-muted-foreground",
                !item.enabled && "opacity-40",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </span>
          );

          const href = selectedDate
            ? `${item.href}?date=${selectedDate}`
            : item.href;

          return item.enabled ? (
            <Link key={item.href} href={href} className="flex flex-1">
              {inner}
            </Link>
          ) : (
            <span
              key={item.href}
              aria-disabled
              className="flex flex-1 cursor-not-allowed"
            >
              {inner}
            </span>
          );
        })}
      </div>
    </nav>
  );
}
