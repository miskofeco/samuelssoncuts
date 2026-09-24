import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isAllowedPushEndpoint } from "@/domain/push-endpoint";
import { reportError } from "@/lib/observability";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/server/auth";
import { enforceRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(4096),
  expirationTime: z.number().finite().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(16).max(4096),
    auth: z.string().min(8).max(4096),
  }),
});

const deleteSchema = z.object({
  endpoint: z.string().url().max(4096),
});

function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return origin === request.nextUrl.origin;
}

// API routes answer JSON, not redirects: an unauthenticated fetch from the
// service-worker opt-in flow must see a 401 rather than a 307 to /login.
async function authenticatedProfile() {
  const { configured, profile } = await getCurrentProfile();
  // Blocked / rejected / pending accounts have nothing to be notified about.
  return configured && profile?.approval_status === "approved" ? profile : null;
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function expirationIso(expirationTime: number | null | undefined) {
  if (!expirationTime) return null;
  const date = new Date(expirationTime);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const profile = await authenticatedProfile();
  if (!profile) {
    return unauthorized();
  }
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid subscription" }, { status: 400 });
  }
  if (!isAllowedPushEndpoint(parsed.data.endpoint)) {
    return NextResponse.json({ ok: false, error: "Invalid subscription" }, { status: 400 });
  }

  const rate = await enforceRateLimit("push-subscription", {
    identity: profile.id,
    limit: 30,
    windowSeconds: 60 * 60,
  });
  if (!rate.ok) {
    return NextResponse.json({ ok: false, error: rate.error }, { status: 429 });
  }

  // The RPC (0032) rebinds an endpoint previously registered by another user
  // of this browser; a plain upsert failed the owner-only UPDATE policy and
  // left the old owner receiving pushes on a device they no longer use.
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
    p_expiration: expirationIso(parsed.data.expirationTime),
    p_user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
  });

  if (error) {
    await reportError("push-subscribe", error, { userId: profile.id });
    return NextResponse.json({ ok: false, error: "Could not save subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const profile = await authenticatedProfile();
  if (!profile) {
    return unauthorized();
  }
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid subscription" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", profile.id)
    .eq("endpoint", parsed.data.endpoint);

  if (error) {
    await reportError("push-unsubscribe", error, { userId: profile.id });
    return NextResponse.json({ ok: false, error: "Could not remove subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
