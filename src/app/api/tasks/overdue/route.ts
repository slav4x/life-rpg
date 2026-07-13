import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/application/auth/session";
import { GameError } from "@/application/game/errors";
import { resolveOverdueTasks } from "@/application/tasks/resolve-overdue-tasks";
import { getLocalDate } from "@/lib/dates/local-date";
import { isTrustedOrigin } from "@/lib/http/origin";
import { resolveOverdueTasksInputSchema } from "@/lib/validation/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
  const parsed = resolveOverdueTasksInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const result = await resolveOverdueTasks(
      user.id,
      getLocalDate(user.timezone),
      parsed.data,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("resolve overdue tasks failed:", (error as Error)?.message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
