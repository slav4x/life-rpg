import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/application/auth/session";
import { getDb } from "@/db/client";
import { listRecentXpEvents } from "@/db/repositories/xp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const raw = Number(new URL(request.url).searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 100) : 20;

  const events = await listRecentXpEvents(getDb(), user.id, limit);
  return NextResponse.json({ events });
}
