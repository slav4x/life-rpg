import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db/client";

// Readiness: unlike /api/health (liveness), this checks the database so the
// container is only "ready" when it can actually serve requests (backlog P0).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ status: "ready" });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
