import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(4096),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(16).max(4096),
    auth: z.string().min(8).max(4096),
  }),
});

const deleteSchema = z.object({
  endpoint: z.string().url().max(4096).optional(),
});

function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return origin === request.nextUrl.origin;
}

// API routes answer JSON, not redirects: an unauthenticated fetch from the
// service-worker opt-in flow must see a 401 rather than a 307 to /login.
async function authenticatedProfile() {
  const { configured, profile } = await getCurrentProfile();
  return configured ? profile : null;
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

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: profile.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      expiration_time: expirationIso(parsed.data.expirationTime),
      user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      enabled: true,
      failure_count: 0,
      last_failure_at: null,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
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
  const parsed = deleteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid subscription" }, { status: 400 });
  }

  const supabase = await createClient();
  let query = supabase.from("push_subscriptions").delete().eq("user_id", profile.id);
  if (parsed.data.endpoint) {
    query = query.eq("endpoint", parsed.data.endpoint);
  }
  const { error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
