import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/application/auth/session";
import { GameError } from "@/application/game/errors";
import { createUserTemplate } from "@/application/templates/create-template";
import { listUserTemplates } from "@/application/templates/manage-template";
import { isTrustedOrigin } from "@/lib/http/origin";
import { createTemplateInputSchema } from "@/lib/validation/task-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const templates = await listUserTemplates(user.id);
  return NextResponse.json({
    templates: templates.map((t) => ({
      id: t.id,
      title: t.title,
      skillId: t.skillId,
      baseXp: t.baseXp,
      difficulty: t.difficulty,
      recurrenceType: t.recurrenceType,
      weekdays: t.weekdays,
      estimatedMinutes: t.estimatedMinutes,
      isActive: t.isActive,
      archivedAt: t.archivedAt,
    })),
  });
}

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

  const parsed = createTemplateInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const template = await createUserTemplate({ userId: user.id, ...parsed.data });
    return NextResponse.json({ template: { id: template.id } }, { status: 201 });
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("create template failed:", (error as Error)?.message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
