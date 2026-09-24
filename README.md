# Samuelsson Cuts

Next.js 16 App Router barber booking app with Supabase Auth/Postgres/RLS and Resend email notifications.

## Local Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create `.env.local` from `.env.example` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SHOP_TIME_ZONE=Europe/Bratislava
NEXT_PUBLIC_SHOP_PHONE=+421918531257
NEXT_PUBLIC_SHOP_ADDRESS="Skrabske 107, 094 33"
RESEND_API_KEY=
RESEND_FROM_ADDRESS="Samuelsson Cuts <noreply@example.com>"
SEND_EMAIL_HOOK_SECRET=
WEB_PUSH_PUBLIC_KEY=
WEB_PUSH_PRIVATE_KEY=
WEB_PUSH_SUBJECT=mailto:noreply@example.com
CRON_SECRET=
ERROR_REPORT_WEBHOOK_URL=
```

3. Apply Supabase migrations in `supabase/migrations` to the target project. After Samuel's approved admin profile exists, ensure it is the sole profile with `is_shop_barber = true`; a fresh database without that profile intentionally rejects booking rather than choosing an arbitrary admin.

4. Start the app:

```bash
pnpm dev
```

## Verification

```bash
pnpm test
pnpm lint
pnpm build
```

The test suite includes production-hardening checks for booking guards, cron auth, and the database overlap constraint.

## Production Notes

- `CRON_SECRET` is required in production. `/api/cron/reminders` returns `503` if it is not configured and `401` unless called with `Authorization: Bearer <CRON_SECRET>`.
- `SUPABASE_SERVICE_ROLE_KEY` is required for transactional account deletion, manual-booking/proposal RPCs, and the reminder cron. The reminder cron runs with no user session, so it uses the service-role client to read appointments across all clients (the RLS-scoped anon client would return zero rows). Keep it server-only and never expose it with a `NEXT_PUBLIC_` prefix.
- Baseline security headers (HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`) are applied to every response via `next.config.ts`.
- A **nonce-based Content-Security-Policy** is emitted per-request by `src/proxy.ts`: scripts use `'nonce-…' 'strict-dynamic'`, and the Supabase origin is allowed for REST, realtime (`wss:`), and Storage images (`img-src`). Because the nonce is per-request, all pages are dynamically rendered (no static/ISR/PPR). If you add a third-party script or API host, extend the CSP in `src/proxy.ts` (`buildCsp`).
- **Admin actions are audited.** Approvals, rejections, blocks, unblocks, deletions, and appointment reschedules/cancellations write an append-only row to `public.admin_audit_log` via the `record_admin_action` SECURITY DEFINER RPC (re-checks `is_admin()`, stamps `actor_id`). View them at `/admin/audit`. Requires migration `0019_admin_audit_log.sql`.
- Notification inserts are restricted to `user_id = auth.uid() OR is_admin()` (migration `0018`). The reminder cron uses the service-role client and is unaffected.
- `NEXT_PUBLIC_SHOP_TIME_ZONE` controls booking date/time conversion and display. The default is `Europe/Bratislava`; set it explicitly in every environment.
- `NEXT_PUBLIC_SHOP_PHONE` and `NEXT_PUBLIC_SHOP_ADDRESS` are public contact details used by legal and appointment pages; they default to the details supplied for this shop.
- Auth, booking mutations, cron, and calendar feeds use the `public.check_rate_limit` RPC backed by `public.rate_limits`.
- `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, and the Supabase Send Email Hook's `SEND_EMAIL_HOOK_SECRET` must be configured before public sign-up. The auth-email hook fails rather than acknowledging a missing delivery. Operational mail and reply-to addresses come from the designated shop barber profile; booking mail remains best-effort.
- Set `NEXT_PUBLIC_SITE_URL` to the public HTTPS domain in production. It is used for email actions, authentication redirects, calendar links, and metadata. The local `http://localhost:3000` example must not be copied to Vercel; when Vercel exposes `VERCEL_PROJECT_PRODUCTION_URL`, the app uses that stable production domain as a fallback. Email templates use remote logo/icons from the public origin but retain readable text and alt text when images are blocked.
- `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, and `WEB_PUSH_SUBJECT` enable installed-PWA push notifications and app-icon badges. Generate the VAPID pair once with `npx web-push generate-vapid-keys --json`; keep the private key server-only and never expose it with a `NEXT_PUBLIC_` prefix.
- `ERROR_REPORT_WEBHOOK_URL` is optional. When set, structured server errors are posted there (with a 3s timeout) in addition to platform logs. Configure your host log drain for stdout/stderr so `logEvent` and `reportError` JSON is retained.
- Uncaught server errors (Server Components, Route Handlers, Server Actions) are captured centrally by `src/instrumentation.ts` (`onRequestError`) and forwarded to `reportError`. To add Sentry, install `@sentry/nextjs` and call `Sentry.captureRequestError(...)` inside that hook.
- Keep Supabase generated types in `src/lib/database.types.ts` in sync with migrations after schema changes.
- The `0016_prevent_overlapping_confirmed_appointments.sql` migration adds a Postgres exclusion constraint to prevent overlapping confirmed appointments per barber. If production already has overlapping confirmed appointments, resolve them before applying the migration.
- The `0017_launch_risk_hardening.sql` migration tightens appointment RLS, adds sanitized busy-slot RPCs, rate limiting, and transactional request/proposal confirmation RPCs.
- Calendar feed URLs contain a per-profile secret token. Treat them as shareable secrets and rotate `profiles.calendar_token` if exposed.
- Migrations are applied in filename order. `0010b_service_images.sql` intentionally sorts after `0010_exact_slot_booking.sql` and before `0011_*` (the two files previously shared the `0010_` prefix, which made ordering ambiguous).
- Before deploying this remediation, apply `0043_proposal_and_push_hardening.sql`, `0044_transactional_client_deletion.sql`, then `0045_availability_write_guards.sql` to staging and resolve any pre-existing data conflicts; only then promote them to production ahead of application code that reads new appointment columns or calls new RPCs.
