"use client";

import { BarChart3, CalendarCheck, ScrollText, Sparkles, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Сегодня", icon: CalendarCheck, enabled: true },
  { href: "/quests", label: "Квесты", icon: ScrollText, enabled: true },
  { href: "/skills", label: "Навыки", icon: Sparkles, enabled: false },
  { href: "/progress", label: "Прогресс", icon: BarChart3, enabled: false },
  { href: "/profile", label: "Профиль", icon: User, enabled: false },
];

export function BottomNav() {
  const pathname = usePathname();

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

          return item.enabled ? (
            <Link key={item.href} href={item.href} className="flex flex-1">
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
