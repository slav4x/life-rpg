import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/application/auth/session";
import { GameError } from "@/application/game/errors";
import { createUserSkill } from "@/application/skills/create-skill";
import { getDb } from "@/db/client";
import { listActiveSkills } from "@/db/repositories/skills";
import { isTrustedOrigin } from "@/lib/http/origin";
import { createSkillInputSchema } from "@/lib/validation/skills";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const skills = await listActiveSkills(getDb(), user.id);
  return NextResponse.json({
    skills: skills.map((s) => ({
      id: s.id,
      name: s.name,
      attributeId: s.attributeId,
      icon: s.icon,
      color: s.color,
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

  const parsed = createSkillInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const skill = await createUserSkill({ userId: user.id, ...parsed.data });
    return NextResponse.json({ skill: { id: skill.id } }, { status: 201 });
  } catch (error) {
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    console.error("create skill failed:", (error as Error)?.message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
