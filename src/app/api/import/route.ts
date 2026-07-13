import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUser } from "@/application/auth/session";
import {
  DataImportError,
  importBackup,
  importContentPack,
} from "@/application/profile/import-data";
import { isTrustedOrigin } from "@/lib/http/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  kind: z.enum(["backup", "content_pack"]),
  replace: z.boolean().optional(),
  data: z.unknown(),
});

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
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const summary =
      parsed.data.kind === "backup"
        ? await importBackup(
            user.id,
            parsed.data.data,
            parsed.data.replace ?? false,
          )
        : await importContentPack(user.id, parsed.data.data);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    if (error instanceof DataImportError) {
      return NextResponse.json(
        { error: error.code, conflicts: error.conflicts },
        { status: error.status },
      );
    }
    console.error("data import failed:", (error as Error)?.message);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
