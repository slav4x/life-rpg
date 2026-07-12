import { NextResponse } from "next/server";

import { logout } from "@/application/auth/logout";
import { isTrustedOrigin } from "@/lib/http/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  await logout();
  return NextResponse.json({ ok: true });
}
