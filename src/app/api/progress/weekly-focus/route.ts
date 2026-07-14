import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/application/auth/session";
import { GameError } from "@/application/game/errors";
import { saveNextWeeklyFocus } from "@/application/progress/save-weekly-focus";
import { isTrustedOrigin } from "@/lib/http/origin";
import { weeklyFocusInputSchema } from "@/lib/validation/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const parsed = weeklyFocusInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    const focus = await saveNextWeeklyFocus(
      user.id,
      user.timezone,
      parsed.data.weekStart,
      parsed.data.focus,
    );
    return NextResponse.json({ focus: focus.focus });
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("save weekly focus failed:", (error as Error)?.message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
