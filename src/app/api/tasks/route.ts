import { NextResponse } from "next/server";

import { GameError } from "@/application/game/errors";
import { getAuthenticatedUser } from "@/application/auth/session";
import { createOneOffTask } from "@/application/tasks/create-task";
import { isTrustedOrigin } from "@/lib/http/origin";
import { createTaskInputSchema } from "@/lib/validation/tasks";

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

  const parsed = createTaskInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const task = await createOneOffTask({ userId: user.id, ...parsed.data });
    return NextResponse.json({ task: { id: task.id } }, { status: 201 });
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("create task failed:", (error as Error)?.message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
