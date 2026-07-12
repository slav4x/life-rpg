import { NextResponse } from "next/server";

import { devSignIn } from "@/application/auth/dev-login";
import { setSessionCookie } from "@/lib/auth/cookies";
import { isDevAuthBypassEnabled } from "@/lib/env";
import { isTrustedOrigin } from "@/lib/http/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Behaves as if the route does not exist unless the dev bypass is enabled.
  if (!isDevAuthBypassEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const { user, token, expiresAt } = await devSignIn();
  await setSessionCookie(token, expiresAt);

  return NextResponse.json({
    user: { id: user.id, firstName: user.firstName },
  });
}
