import { NextResponse } from "next/server";

import { getWebPushPublicKey } from "@/lib/env";
import { getCurrentProfile } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { configured, profile } = await getCurrentProfile();
  if (!configured || !profile) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const publicKey = getWebPushPublicKey();
  if (!publicKey) {
    return NextResponse.json({ ok: false, reason: "not_configured" });
  }

  return NextResponse.json({ ok: true, publicKey });
}
