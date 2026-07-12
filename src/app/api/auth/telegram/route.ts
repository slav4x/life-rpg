import { NextResponse } from "next/server";

import { authenticateWithTelegram } from "@/application/auth/authenticate";
import { setSessionCookie } from "@/lib/auth/cookies";
import { AuthError } from "@/lib/auth/errors";
import { isTrustedOrigin } from "@/lib/http/origin";
import { telegramAuthInputSchema } from "@/lib/validation/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = telegramAuthInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const { user, token, expiresAt } = await authenticateWithTelegram(
      parsed.data.initData,
    );
    await setSessionCookie(token, expiresAt);

    return NextResponse.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.telegramUsername,
        photoUrl: user.photoUrl,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    // Never log initData or secrets (SPEC §9.3).
    console.error("telegram auth failed:", (error as Error)?.message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
