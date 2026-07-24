# Samuelsson Cuts Architecture

This file is the project map for coding agents. Read it before making code changes, then inspect the current files you will touch because this document is a guide, not a substitute for source.

When an agent changes an architectural part of the project, it must update this file in the same change. Architectural changes include route/layout structure, server action boundaries, auth/authorization flow, Supabase schema/RLS/RPC behavior, cross-cutting integrations, env/config requirements, notification/email/push flow, cron/calendar behavior, or major folder ownership.

## System Summary

Samuelsson Cuts is a Next.js 16 App Router barber booking app. It uses Supabase Auth, Postgres, Storage, RLS, and Realtime; Resend for transactional email; Web Push for installed-PWA notifications; and a small Node test suite for high-risk behavior.

The app has two authenticated workspaces:

- Client workspace: booking, reservations, notifications, profile, self-service cancellation/reschedule, privacy controls.
- Admin workspace: dashboard, calendar, request queue, approvals, clients, availability, audit log, services, pricing, push opt-in.

Most routes are dynamically rendered because `src/proxy.ts` emits a per-request CSP nonce and refreshes Supabase auth cookies.

## Runtime Stack

- App framework: Next.js `16.2.9`, React `19.2.4`, App Router under `src/app`.
- Styling: Tailwind CSS v4 through `postcss.config.mjs` and `src/app/globals.css`.
- Data/auth: Supabase SSR clients in `src/lib/supabase`, generated DB types in `src/lib/database.types.ts`, migrations in `supabase/migrations`.
- Email: React Email templates in `src/emails`, Resend delivery through `src/lib/email.ts`.
- Push: `web-push`, API routes under `src/app/api/push`, browser service worker in `public/sw.js`.
- Charts: Recharts components under `src/components/charts`.
- Tests: `node --experimental-strip-types --test tests/*.test.mjs` through `pnpm test`.

## Top-Level Layout

```text
src/app/                 App Router pages, layouts, route handlers, server actions
src/components/          Client and server UI components by area
src/domain/              Pure domain types and logic: scheduling, analytics, charts
src/server/              Server-only auth, loaders, guards, audit, notifications, rate limits
src/lib/                 Shared infrastructure: env, Supabase clients, email, time, consent, ICS
src/i18n/                Slovak/English dictionaries and language providers
src/emails/              React Email templates
src/hooks/               Client hooks, including Supabase realtime badge refresh
public/                  Static assets, app icons, service worker
supabase/migrations/     Database schema, RLS policies, RPCs, buckets, hardening
tests/                   Node tests for domain logic and production hardening
```

## Request Lifecycle

1. Incoming requests pass through `src/proxy.ts`.
2. The proxy builds a CSP nonce, attaches CSP headers, and calls `updateSession` from `src/lib/supabase/proxy.ts`.
3. `updateSession` refreshes Supabase auth cookies and forwards request headers so Server Components can read the nonce.
4. `src/app/layout.tsx` resolves language, consent, metadata, and theme script nonce.
5. Route layouts enforce auth:
   - `src/app/admin/layout.tsx` calls `requireAdmin()` and loads admin attention badge counts.
   - `src/app/client/layout.tsx` calls `requireApprovedClient()` and loads unread notification count.
6. Pages call focused loaders from `src/server/dashboard-data.ts`, then render area components from `src/components/admin` or `src/components/client`.
7. Mutations go through server actions in `src/app/actions.ts`, which validate inputs with Zod, enforce auth and rate limits, apply Supabase writes or RPCs, create notifications/email, audit admin actions, and revalidate paths.

## Routing Map

Public and account routes:

- `/` redirects or routes users toward their dashboard.
- `/login`, `/register`, `/reset-password`, `/auth/update-password`, `/complete-profile`, `/pending`, `/setup`.
- `/terms`, `/privacy`, `/cookies`, `/robots.txt`, `/sitemap.xml`, app manifest, Open Graph and Twitter images.
- `/email-preview` renders transactional email previews in Node runtime.

Client routes:

- `/client`: overview of requests, proposals, upcoming appointments, availability notices.
- `/client/book`: exact-slot booking using services, business hours, blocked times, and pricing.
- `/client/reservations`: reservation list.
- `/client/reservations/[id]`: appointment detail and self-service actions.
- `/client/notifications`: notification inbox and Web Push opt-in.
- `/client/profile`: profile, avatar, calendar export, privacy/data actions.

Admin routes:

- `/admin`: operational dashboard, booking strip, overview metrics, analytics charts.
- `/admin/calendar`: schedule view and appointment management.
- `/admin/requests`: incoming booking request queue and proposal flow.
- `/admin/approvals`: pending client approvals.
- `/admin/clients` and `/admin/clients/[clientId]`: directory and client history.
- `/admin/availability`: business hours and blocked time management.
- `/admin/audit`: admin action audit log.
- `/admin/settings`: services, service images, pricing settings, push opt-in.

API routes:

- `/api/auth/send-email`: Supabase Send Email Hook, verified with Standard Webhooks HMAC, sends branded auth emails through Resend.
- `/auth/callback`: OAuth/PKCE callback and recovery-session handoff.
- `/auth/confirm`: token-hash auth email verification.
- `/api/cron/reminders`: Vercel cron reminder job, authorized by `CRON_SECRET`.
- `/api/cron/complete-appointments`: Vercel cron outcome sweep, authorized by `CRON_SECRET`; marks confirmed appointments `completed` after they ended at least two hours ago unless an outcome was already recorded.
- `/api/calendar/export`: authenticated one-off ICS download.
- `/api/calendar/feed/[token]`: token-authorized ICS subscription feed through a SECURITY DEFINER RPC.
- `/api/calendar/event/[appointmentId]`: appointment ICS event.
- `/api/push/public-key`: authenticated public VAPID key fetch.
- `/api/push/subscriptions`: same-origin authenticated subscription upsert/delete.

## Auth And Authorization

Auth state is centralized in `src/server/auth.ts`.

- `getCurrentProfile()` reads Supabase claims and the `profiles` row.
- `requireProfile()` redirects to `/setup` when Supabase env is absent, `/login` when unauthenticated.
- `requireAdmin()` allows only approved admins, otherwise redirects to the client or pending flow.
- `requireApprovedClient()` keeps admins out of client routes, forces missing-phone profiles through `/complete-profile`, and blocks pending/rejected/blocked users at `/pending`.
- `dashboardPathFor()` is the central post-auth routing decision.

Supabase RLS is the primary data boundary. Admin-only bypasses use `getSupabaseAdminClient()` and must remain server-only.

## Core Data Model

Primary tables and concepts:

- `profiles`: auth-linked users, roles, approval status, phone, avatar, calendar token.
- `services`: barber services, duration, price, active flag, optional image.
- `business_hours`: weekly open/closed windows.
- `blocked_times`: date or time ranges the barber cannot take bookings.
- `booking_requests`: client requested exact slot and request status.
- `booking_preferences`: legacy/request preference support.
- `appointment_proposals`: admin-proposed times for requests.
- `appointments`: confirmed bookings, walk-ins, status, outcome, reminder timestamp.
- `notifications`: email/push/in-app notification rows and read state.
- `cookie_consents`: consent snapshots.
- `admin_audit_log`: append-only admin action log.
- `rate_limits`: backing table for the `check_rate_limit` RPC.
- `push_subscriptions`: Web Push endpoints scoped to owning users.
- `pricing_settings`: configurable gap and VIP surcharges.

Important RPCs and constraints live in migrations:

- `is_admin()` gates admin RLS.
- `phone_taken()` gives friendly duplicate-phone checks despite RLS.
- `confirmed_appointment_slots()` returns sanitized busy slots.
- `has_confirmed_appointment_overlap()` detects booking conflicts.
- `confirm_booking_request()` and `respond_to_appointment_proposal()` make request/proposal transitions transactional.
- `client_cancel_confirmed_appointment()` and `client_request_reschedule()` handle client self-service safely.
- `record_admin_action()` writes audit rows after re-checking admin privileges.
- `calendar_feed()` powers token-based ICS feeds.
- A Postgres exclusion constraint prevents overlapping confirmed appointments per barber.

## Domain Boundaries

`src/domain` should stay mostly pure and easy to test:

- `types.ts`: shared app/domain types.
- `schedule.ts`: services defaults, slot generation, booking window rules, month/week helpers, business-hour checks, preferred slot/gap/VIP pricing helpers.
- `analytics.ts`: admin metrics, revenue trends, outcomes, request status summaries, weekday charts.
- `chart-scale.ts`: chart tick scaling.

`src/server` is for server-only orchestration:

- `dashboard-data.ts`: Supabase reads, row-to-domain mapping, page-specific loaders.
- `booking-guards.ts`: server-side business hour, blocked time, and overlap guards.
- `rate-limit.ts`: wrapper around the `check_rate_limit` RPC.
- `audit.ts`: admin action audit RPC wrapper.
- `notifications.ts`: centralized notification inserts plus non-fatal push delivery.
- `push-payloads.ts`: pure badge and push payload derivation.

`src/app/actions.ts` is the main mutation boundary. Keep validation, auth, rate limits, conflict checks, notification creation, audit logging, and path revalidation together there unless a smaller server module already owns that concern.

## Booking Flow

Client exact-slot booking:

1. Client pages load services, blocked ranges, business hours, pricing settings, confirmed busy slots, and pending requested slots.
2. UI uses `clientSlotsForService`, `slotStatusFor`, and `priceForSlot` to display availability and pricing.
3. `createBookingRequestAction` validates the slot, checks future/window/business hours/blocked/confirmed conflicts, inserts the request, and notifies admins.
4. Admin can confirm directly, propose alternatives, or cancel/decline through server actions.

Admin booking and calendar changes:

- `createAdminBookingAction` can book an existing client or a walk-in.
- Reschedules and cancellations go through server actions that re-run conflict guards, update appointments, create notifications/email, and audit the action.
- Confirmed appointment overlap protection exists both in app guards and in the database exclusion constraint/RPCs.

## Notifications, Email, And Push

- Transactional emails are React components in `src/emails` and go through `sendEmail()` in `src/lib/email.ts`.
- Missing `RESEND_API_KEY` is non-fatal in local dev; emails are logged and notification rows still exist.
- In-app notifications should be created through `createNotification`, `createNotifications`, or `createAdminNotification` in `src/server/notifications.ts`.
- Push delivery is best-effort and non-fatal. Invalid subscriptions are deleted or marked failed.
- `PushBadgeSync` registers `public/sw.js` and keeps foreground app badge counts aligned.
- Admin sidebar attention counts are server-computed and refreshed by `revalidatePath`; Supabase Realtime is only a background refresh nudge.

## Realtime Sidebar Constraint

The desktop sidebar stays mounted on mobile and the mobile drawer mounts a second `Sidebar` instance. Any hook inside `Sidebar` can run twice at once.

`useAttentionRefresh` must use a per-mount stable channel name derived from `useId`. Do not replace it with a static channel name like `supabase.channel("admin-attention")`.

## Localization, Theme, And Consent

- Slovak is the default language. Language is stored in the `lang` cookie and resolved by `src/i18n/server.ts`.
- Server Components and actions call `getDict()` for localized strings.
- Client components use `LanguageProvider`, `useT()`, and `useLang()`.
- Consent state lives in `src/lib/consent` and UI providers/components under `src/components/consent`.
- Theme initialization uses `ThemeScript` with the CSP nonce in `src/app/layout.tsx`.

## Security And Operational Notes

- Read `node_modules/next/dist/docs/` before writing Next.js code. This app uses Next 16 APIs and conventions.
- CSP is built in `src/proxy.ts`; adding external scripts, APIs, realtime hosts, or image hosts may require CSP changes.
- `next.config.ts` applies baseline security headers and Supabase avatar image patterns.
- `SUPABASE_SERVICE_ROLE_KEY` is required only on the server for admin-only operations and cron.
- `CRON_SECRET` protects the reminder route.
- Calendar feed tokens are shareable secrets. Rotate `profiles.calendar_token` if exposed.
- `NEXT_PUBLIC_SHOP_TIME_ZONE` controls booking and display conversion. Default is `Europe/Bratislava`, but production should set it explicitly.
- Keep `src/lib/database.types.ts` in sync with migrations after schema changes.

## Testing And Verification

Use risk-based verification. Do not create or run tests blindly for every cosmetic edit.

- Use TDD or test-first changes for business logic, auth/authorization, booking conflict rules, database/RLS/RPC behavior, notifications, email hooks, push, cron, calendar export/feed behavior, and cross-route integration changes.
- For small color, spacing, copy, or documentation changes, a direct edit plus targeted verification is usually enough.
- Existing tests are Node tests in `tests/*.test.mjs`. They often assert pure functions or hardening invariants by reading source and migrations.
- Run focused tests first when possible, then `pnpm test`, `pnpm lint`, and `pnpm build` when the change risk or blast radius justifies it.

## Where To Change Things

- New route or page: add under `src/app`, load data with `src/server/dashboard-data.ts`, reuse shared/admin/client components.
- New mutation: add or extend a server action in `src/app/actions.ts`; validate with Zod; call auth and rate-limit helpers; revalidate affected layouts/pages.
- New shared UI primitive: add to `src/components/shared`.
- Admin-only UI: use `src/components/admin`; client-only UI: use `src/components/client`.
- Scheduling/pricing math: update `src/domain/schedule.ts` and add focused tests.
- Analytics math: update `src/domain/analytics.ts` or `src/domain/chart-scale.ts` and add focused tests.
- Database schema/RLS/RPC: add a migration and update `src/lib/database.types.ts`.
- Email content: update `src/emails` and preview via `/email-preview` when running the app.
- Push behavior: keep subscription APIs, `public/sw.js`, `src/server/notifications.ts`, and `src/server/push-payloads.ts` in sync.
- Appointment outcome automation: keep `src/server/appointment-outcomes.ts`, `/api/cron/complete-appointments`, `vercel.json`, and the supporting Supabase index in sync.
