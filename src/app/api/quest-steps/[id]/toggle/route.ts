import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUser } from "@/application/auth/session";
import { GameError } from "@/application/game/errors";
import { toggleStep } from "@/application/quests/toggle-step";
import { isTrustedOrigin } from "@/lib/http/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "invalid_step_id" }, { status: 400 });
  }

  try {
    const result = await toggleStep({ userId: user.id, stepId: id });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("toggle step failed:", (error as Error)?.message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
