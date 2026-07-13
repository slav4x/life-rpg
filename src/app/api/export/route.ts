import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/application/auth/session";
import { exportUserData } from "@/application/profile/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const data = await exportUserData(user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="life-rpg-export.json"',
    },
  });
}
