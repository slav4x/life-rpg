import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/application/auth/session";
import { GameError } from "@/application/game/errors";
import { createUserQuest } from "@/application/quests/create-quest";
import { listUserQuests } from "@/application/quests/manage-quests";
import { isTrustedOrigin } from "@/lib/http/origin";
import { createQuestInputSchema } from "@/lib/validation/quests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const quests = await listUserQuests(user.id);
  return NextResponse.json({ quests });
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
  const parsed = createQuestInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const quest = await createUserQuest({ userId: user.id, ...parsed.data });
    return NextResponse.json({ quest: { id: quest.id } }, { status: 201 });
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("create quest failed:", (error as Error)?.message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
