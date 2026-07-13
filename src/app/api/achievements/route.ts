import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/application/auth/session";
import { getDb } from "@/db/client";
import {
  listAchievements,
  listUserAchievements,
} from "@/db/repositories/achievements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [all, unlocked] = await Promise.all([
    listAchievements(db),
    listUserAchievements(db, user.id),
  ]);
  const unlockedIds = new Set(unlocked.map((u) => u.achievementId));

  return NextResponse.json({
    achievements: all.map((a) => ({
      code: a.code,
      name: a.name,
      description: a.description,
      icon: a.icon,
      unlocked: unlockedIds.has(a.id),
    })),
  });
}
