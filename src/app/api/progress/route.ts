import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/application/auth/session";
import { getProgressData, isProgressPeriod } from "@/application/progress/get-progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const period = new URL(request.url).searchParams.get("period") ?? "7d";
  if (!isProgressPeriod(period)) {
    return NextResponse.json({ error: "invalid_period" }, { status: 400 });
  }

  const data = await getProgressData(user.id, period, user.timezone);
  return NextResponse.json(data);
}
