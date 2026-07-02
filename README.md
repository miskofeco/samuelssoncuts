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
RESEND_API_KEY=
RESEND_FROM_ADDRESS="Samuelsson Cuts <noreply@example.com>"
BARBER_EMAIL=
CRON_SECRET=
ERROR_REPORT_WEBHOOK_URL=
```

3. Apply Supabase migrations in `supabase/migrations` to the target project.

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
- `SUPABASE_SERVICE_ROLE_KEY` is required for admin-only Auth user deletion. Keep it server-only and never expose it with a `NEXT_PUBLIC_` prefix.
- `NEXT_PUBLIC_SHOP_TIME_ZONE` controls booking date/time conversion and display. The default is `Europe/Bratislava`; set it explicitly in every environment.
- Auth, booking mutations, cron, and calendar feeds use the `public.check_rate_limit` RPC backed by `public.rate_limits`.
- `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, and `BARBER_EMAIL` should be configured before launch. Without `RESEND_API_KEY`, email sends are skipped and logged.
- `ERROR_REPORT_WEBHOOK_URL` is optional. When set, structured server errors are posted there in addition to platform logs. Configure your host log drain for stdout/stderr so `logEvent` and `reportError` JSON is retained.
- Keep Supabase generated types in `src/lib/database.types.ts` in sync with migrations after schema changes.
- The `0016_prevent_overlapping_confirmed_appointments.sql` migration adds a Postgres exclusion constraint to prevent overlapping confirmed appointments per barber. If production already has overlapping confirmed appointments, resolve them before applying the migration.
- The `0017_launch_risk_hardening.sql` migration tightens appointment RLS, adds sanitized busy-slot RPCs, rate limiting, and transactional request/proposal confirmation RPCs.
- Calendar feed URLs contain a per-profile secret token. Treat them as shareable secrets and rotate `profiles.calendar_token` if exposed.
