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
- Styling: Tailwind CSS v4 through `postcss.config.mjs` and `src/app/globals.css`, which defines the shadcn design tokens (warm stone palette, light/dark via the `.dark` class) and imports `tw-animate-css` and `shadcn/tailwind.css`.
- UI kit: shadcn v4 primitives generated into `src/components/ui` (`components.json`, radix base, `iconLibrary: "hugeicons"`). App-level wrappers with stable APIs live in `src/components/shared` (Button, Card, Modal, Sheet, ConfirmDialog, Field, Combobox, DateField (single-date shadcn Calendar in a popover, "yyyy-mm-dd" contract, Monday-first, sk/en locale), ScheduleCalendar (large-cell shadcn Calendar with `modifiers`/`renderDay`/`dayClassName` for the client booking picker and the admin month overview; the old hand-rolled `MonthCalendar` is gone), DataTable, StatCard, StatusPill, EmptyState…). Icons come only from `@hugeicons/core-free-icons` through `src/components/shared/icon.tsx`. Calendar variants map to use cases: single-date popover for form fields (`DateField`), `mode="range"` for whole-day availability blocks, `ScheduleCalendar` (appointment-picker layout: calendar + time slots) for client booking, fluid `ScheduleCalendar` for the admin month view, and a small single-date popover in the admin toolbar to jump to a date; the admin week/day time grids stay custom.
- Fonts: Geist self-hosted through `next/font/google` in `src/app/layout.tsx` (exposed as `--font-geist`).
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

Authenticated page segments colocate a `loading.tsx` boundary with each route. These boundaries render
route-specific skeletons from `src/components/admin/admin-loading-skeletons.tsx` and
`src/components/client/client-loading-skeletons.tsx`; the root admin/client boundaries cover only their
dashboard pages. Shared loading surfaces and accessibility behavior live in
`src/components/shared/skeleton.tsx`. Keep each skeleton aligned with the route's stable responsive
structure (filters, cards, tables, calendars, and forms) rather than using a generic page placeholder.

API routes:

- `/api/auth/send-email`: Supabase Send Email Hook, verified with Standard Webhooks HMAC, sends branded auth emails through Resend.
- `/auth/callback`: OAuth/PKCE callback and recovery-session handoff.
- `/auth/confirm`: token-hash auth email verification.
- `/api/cron/reminders`: the single daily Vercel cron job (`0 8 * * *`), authorized by `CRON_SECRET`. In one pass it runs the outcome sweep (marks confirmed appointments `completed` after they ended at least two hours ago unless an outcome was already recorded, declines expired pending requests, expires unaccepted proposals), then sends next-day client reminders and the designated barber's agenda to his profile email. The project deploys on the Vercel Hobby plan, which only allows cron jobs that run once per day, so do not add more frequent schedules or additional cron entries to `vercel.json`.
- `/api/calendar/export`: authenticated one-off ICS download.
- `/api/calendar/feed/[token]`: token-authorized ICS subscription feed through a SECURITY DEFINER RPC.
- `/api/calendar/event/[appointmentId]`: appointment ICS event.
- `/api/push/public-key`: authenticated public VAPID key fetch.
- `/api/push/subscriptions`: same-origin authenticated subscription upsert/delete.
- `/api/admin/attention`: admin-only, uncached attention counts for realtime navigation badges; background changes no longer refresh the whole route.

## Auth And Authorization

Auth state is centralized in `src/server/auth.ts`.

- `getCurrentProfile()` reads Supabase claims and the `profiles` row.
- `requireProfile()` redirects to `/setup` when Supabase env is absent, `/login` when unauthenticated.
- `requireAdmin()` allows only approved admins, otherwise redirects to the client or pending flow.
- `requireApprovedClient()` keeps admins out of client routes, forces missing-phone profiles through `/complete-profile`, and blocks pending/rejected/blocked users at `/pending`.
- `dashboardPathFor()` is the central post-auth routing decision. `/login`, `/register` and `/pending` redirect through it when the visitor is already signed in or does not belong on that page, so no auth page is reachable in the wrong state. A session whose `profiles` row is missing is reported as `authenticated: true, profile: null`; `/login` then offers only a sign-out (code `profile_missing`) instead of looping.

Sign-in and registration flow:

- `signInAction` and `registerAction` are `useActionState` actions (`src/components/auth/login-form.tsx`, `register-form.tsx`) returning `AuthFormState` from `src/domain/auth-form.ts`: field-level errors, echoed values (never the password), and `unconfirmedEmail` when Supabase answers `email_not_confirmed`. The login form then exposes `resendConfirmationAction` (rate limited, neutral outcome).
- Registration validates every field at once, normalises the phone with `src/domain/phone.ts` (`parsePhone`: separators stripped, `00` → `+`, 7–15 digits), pre-checks `phone_taken`, and treats Supabase's obfuscated "existing user" sign-up (empty `identities`) or `user_already_exists` as an email-taken field error instead of pretending a confirmation email was sent. Success lands on `/login?notice=confirm_sent&email=…` (or `/dashboard` when confirmations are disabled and a session is returned).
- Google OAuth accounts have a verified email but no phone; `requireApprovedClient` sends them to `/complete-profile` first. A registration only becomes actionable for the barber once `isReadyForApproval()` (`src/domain/approval.ts`: confirmed email **and** phone) holds. The approval queue, admin overview, attention counts, badge counts and `approveClientAction` all apply that rule.
- Auth pages never render free text from the URL. Route handlers and redirecting actions pass short codes (`?error=oauth_failed`, `?notice=confirm_sent`) that `src/i18n/auth-notices.ts` resolves to localised copy; unknown codes render nothing. `/auth/callback` maps a Google `access_denied` to `oauth_cancelled`, and failed recovery links (callback, confirm or a missing session on `/auth/update-password`) go to `/reset-password?error=reset_link_invalid`.
- Every phone write path (`registerAction`, `completePhoneAction`, `updateProfileAction`) stores the canonical form; migration `0031` makes `phone_taken` compare both sides through `normalize_phone()` so pre-existing rows with spaces still collide correctly.

Supabase RLS is the primary data boundary. Admin-only bypasses use `getSupabaseAdminClient()` and must remain server-only.
Migrations `0038` and `0039` preserve the existing RLS roles and predicates while caching row-independent `auth.uid()`, `auth.jwt()`, and `is_admin()` checks once per statement. Each migration checks the reviewed policy fingerprint before applying. Migration `0040` adds the five previously missing foreign-key indexes on proposals, appointments, and requests; none of these migrations changes table columns or generated TypeScript row types.

## Core Data Model

Primary tables and concepts:

- `profiles`: auth-linked users, roles, approval status, phone, avatar, calendar token, and the unique `is_shop_barber` marker.
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
- `phone_taken()` gives friendly duplicate-phone checks; executable by the service role only (it was an anonymous phone-enumeration oracle), so `isPhoneTaken` in `actions.ts` always uses the admin client.
- `confirmed_appointment_slots()` returns sanitized busy slots from yesterday onwards (the picker never needs history).
- `is_approved_client()` is checked inside every client-facing RPC (`respond_to_appointment_proposal`, `client_cancel_request`, `client_cancel_confirmed_appointment`), so blocked or rejected accounts cannot drive booking state through PostgREST.
- `upsert_push_subscription()` binds a browser push endpoint to the caller even when another user registered it earlier on the same device.
- `rotate_my_calendar_token()` lets the owner invalidate a leaked feed URL; `calendar_feed()` only serves approved accounts.
- `appointment_proposals_one_sent_per_request` guarantees a single open proposal per request.
- Profile deletion scrubs the person's `notifications` rows (trigger `profiles_scrub_notifications`).
- `has_confirmed_appointment_overlap()` detects booking conflicts.
- `confirm_booking_request()` and `respond_to_appointment_proposal()` make request/proposal transitions transactional.
- `client_cancel_confirmed_appointment()` and `client_request_reschedule()` handle client self-service safely. `client_request_reschedule` is service-role only and takes the acting client id plus the server-computed quote; clients cannot call it (or insert into `booking_requests`) directly, so a booking price can only ever come from `quoteClientSlot`. Reschedule conflict checks use the designated barber even when the old appointment has another owner.
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

1. `src/server/shop-barber.ts` resolves the sole approved barber from `profiles.is_shop_barber` (migration `0033`). Client pages load that barber's blocked ranges, business hours, pricing settings, confirmed busy slots, and pending requested slots. The picker limits blocked times, pending requests, and the `confirmed_appointment_slots_window` RPC (migration `0036`) to today's two-week booking horizon; slot quotes request only one day. Migration `0037` adds the composite index for blocked-time lookups. A missing marker fails closed instead of selecting an arbitrary admin row.
2. UI uses `clientSlotsForService`, `slotStatusFor`, and `priceForSlot` to display availability and pricing.
3. `createBookingRequestAction` validates the slot against the same barber's hours/blocks/confirmed appointments, checks the future/window, inserts the request, and notifies admins. Independent slot guards, quote reads, and post-insert notification/email delivery run concurrently while preserving the guard's error priority.
4. Any approved admin (including Michal's management account) can confirm directly, propose alternatives, reschedule, or cancel/decline through server actions, but new appointments and proposals are owned by the designated barber account (Samuel). `confirm_booking_request` checks that `p_barber_id` is marked `is_shop_barber` before writing, and the rescheduling RPCs use the same marker.

The client reservations list loads picker context only when it has upcoming appointments; a detail page skips that context for cancelled or locked appointments. The reschedule picker and admin calendar action modals are separate lazy client chunks. Admin overview requests use a summary projection without note text or embedded proposals/preferences, while the request queue keeps its richer records.

Admin booking and calendar changes:

- `createAdminBookingAction` can book an existing client or a walk-in under the designated barber, regardless of which approved admin performs the action. Availability, pricing, blocked-time management, the operational calendar, analytics, and the admin calendar feed also use the designated barber. Migration `0035` moves still-future bookings and sent proposals from older admin owners to Samuel after checking appointment and blocked-time conflicts; past appointments stay with their original owner.
- The admin calendar shows pending exact-slot requests at the client's requested time and proposed requests at their active sent proposal time, alongside confirmed appointments. Open requests do not block availability until confirmed. The calendar detail uses the same admin actions as the request queue: confirm the original pending slot, decline the request, or propose another time. A sent proposal remains awaiting the client's acceptance; it can be declined or replaced, not confirmed through the pending-request action.
- The request queue keeps “propose another time” visible on open requests. A request header is expandable only for a non-blank client note or legacy time preferences; the alternate-time picker opens independently. Exact-slot requests and active proposals show a read-only four-hour desktop day preview beside content-sized decision controls; confirmed appointments and the unreserved request/proposal occupy separate lanes. The preview links to the full admin day calendar, while the alternate-time picker starts near the current requested/proposed time.
- Reschedules and cancellations go through server actions that re-run conflict guards, update appointments, create notifications/email, and audit the action.
- Historical appointments are immutable: the admin UI removes move/cancel controls after an appointment ends or receives an outcome, the reschedule server action re-checks that state, and migration `0041` enforces the same rule inside the transactional reschedule RPC.
- Confirmed appointment overlap protection exists both in app guards and in the database exclusion constraint/RPCs.

## Notifications, Email, And Push

- Transactional emails are React components in `src/emails` and go through `sendEmail()` in `src/lib/email.ts`. The reply-to and operational barber recipient resolve from the designated barber profile, not an admin account or `BARBER_EMAIL` environment setting.
- Email presentation is shared by `src/emails/layout.tsx`: React Email table-based primitives reproduce the app's stone cards, status accents, appointment summaries, and labeled actions. Remote images (the `logo-light.png` wordmark and PNG icons in `public/email-icons`, Hugeicons-styled plus Google's G and Apple's logo for calendar buttons) are fetched by the recipient's mail client, so every `src` is built with `getEmailAssetOrigin()` in `src/lib/env.ts`: `EMAIL_ASSET_ORIGIN` if set (HTTPS-only in production), else the HTTPS site URL, else the canonical production origin. It never yields localhost or a protected preview URL, which is what previously left empty image placeholders in the barber's inbox. `src/proxy.ts` adds that origin to the CSP `img-src` so `/email-preview` (srcDoc iframes inherit the page CSP) displays the same remote images. The logo carries styled alt text and icons are decorative (`alt=""`) next to text labels, so blocked images still read correctly. `getSiteUrl()` uses `NEXT_PUBLIC_SITE_URL` for public links, falling back to Vercel's stable production domain when a local development URL reaches a deployment; a Vercel production runtime without either public URL fails closed instead of sending localhost or protected preview links.
- Missing `RESEND_API_KEY` is non-fatal in local dev; emails are logged and notification rows still exist.
- In-app notifications should be created through `createNotification`, `createNotifications`, or `createAdminNotification` in `src/server/notifications.ts`.
- Push delivery is best-effort and non-fatal. Notification rows are inserted before `after()` defers push delivery beyond the action/route response. Invalid subscriptions are deleted or marked failed. Push payloads carry the subject only, never the free-text body.
- The daily cron claims `reminded_at` atomically before sending (and releases it when the send fails), batches profile/service lookups, sends with bounded concurrency, sets `maxDuration = 60`, and prunes expired `rate_limits` rows.
- `PushBadgeSync` registers `public/sw.js` once and keeps foreground app badge counts aligned with both server counts and admin realtime count events.
- Admin navigation attention counts are server-computed and refreshed by `revalidatePath`; Supabase Realtime fetches `/api/admin/attention` for background changes and updates only mounted badge views instead of refreshing the whole route.
- `vercel.json` pins functions to `dub1`, close to the Supabase project in `eu-west-1`; the change takes effect on the next Vercel deployment.

## App Shell And Navigation

`src/components/layout/app-shell.tsx` (server) wraps both authenticated workspaces:

- `md` and up: a collapsible shadcn `Sidebar` (`layout/sidebar.tsx`, state persisted in the `sidebar_state` cookie, read server-side to avoid a flash) plus a slim sticky utility header with the sidebar trigger, language and theme toggles. The account menu is a dropdown in the sidebar footer.
- Below `md`: `layout/mobile-nav.tsx` renders a top bar (logo, theme toggle, avatar → account bottom sheet) and a fixed bottom tab bar with up to four primary destinations; remaining destinations open a "More" bottom sheet. The shell adds `--spacing-bottom-nav` plus the safe-area inset as bottom padding so content never hides behind the tab bar.
- Navigation items, badge mapping and active-state rules are defined once in `layout/nav-items.tsx`.
- Shared `Modal` renders a swipeable vaul drawer on phones and a Radix dialog from `sm` up; `ConfirmDialog` stays a centred alert dialog everywhere.

## Realtime Attention Refresh Constraint

`useAttentionRefresh` is mounted exactly once per shell by `layout/attention-refresh.tsx` (admin only). Do not call it from navigation components: the desktop sidebar and phone navigation both stay mounted, so a hook inside them would open two Realtime channels. Both navigation components may subscribe to the lightweight local count event through `useLiveAttention`.

`useAttentionRefresh` must keep using a per-mount stable channel name derived from `useId`. Do not replace it with a static channel name like `supabase.channel("admin-attention")`.

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
- Calendar feed tokens are shareable secrets. Both the admin calendar and the client reservations page expose "Generate a new link" (`rotateCalendarTokenAction`). The feed route validates the token shape, rate-limits per IP and per hashed token, and never persists the raw token.
- Logs and the error webhook must not contain personal data: `reportError`/`logEvent` redact email addresses and phone-like numbers, and callers pass ids or kinds rather than recipients or subjects.
- Secret-bearing server modules (`lib/supabase/admin.ts`, `lib/email.ts`, `server/notifications.ts`, `server/rate-limit.ts`, `server/cron-auth.ts`) import `server-only`.
- Auth rate limits are keyed per IP and, more generously, per email so a stranger cannot lock a victim out of sign-in, reset or resend by hammering their address.
- Calendar/push API routes require `approval_status = 'approved'`; GDPR export and erasure (`exportMyDataAction`, `deleteMyAccountAction`) deliberately do not, and are offered on `/pending` as well as the account page.
- `NEXT_PUBLIC_SHOP_TIME_ZONE` controls booking and display conversion. Default is `Europe/Bratislava`, but production should set it explicitly.
- Keep `src/lib/database.types.ts` in sync with migrations after schema changes.

## Testing And Verification

Use risk-based verification. Do not create or run tests blindly for every cosmetic edit.

- Use TDD or test-first changes for business logic, auth/authorization, booking conflict rules, database/RLS/RPC behavior, notifications, email hooks, push, cron, calendar export/feed behavior, and cross-route integration changes.
- For small color, spacing, copy, or documentation changes, a direct edit plus targeted verification is usually enough.
- Existing tests are Node tests in `tests/*.test.mjs`. They often assert pure functions or hardening invariants by reading source and migrations.
- Run focused tests first when possible, then `pnpm test`, `pnpm lint`, and `pnpm build` when the change risk or blast radius justifies it.

## Where To Change Things

- New route or page: add under `src/app`, load data with `src/server/dashboard-data.ts`, reuse shared/admin/client components. `createClient()`, `getCurrentProfile()` and `getLang()` are wrapped in React `cache()`, so layouts, pages and nested loaders share one Supabase client and one profile read per request. Admin loaders are bounded: overview/analytics to 13 trailing months, the calendar to the months around the requested `?date=` (`adminCalendarWindow`), the request queue to open requests plus 90 days of history. Never `select("*")` on `profiles` in page loaders; use `PROFILE_SELECT` so `calendar_token` stays out of page payloads.
- New mutation: add or extend a server action in `src/app/actions.ts`; validate with Zod; call auth and rate-limit helpers; revalidate affected layouts/pages.
- New shared UI primitive: compose from `src/components/ui` (add missing shadcn components with `pnpm dlx shadcn@latest add <name>`; `components.json` already targets hugeicons) and expose an app-level wrapper in `src/components/shared`. Never import `lucide-react` or hand-write SVG icons; use `Icon` from `src/components/shared/icon.tsx`.
- Admin-only UI: use `src/components/admin`; client-only UI: use `src/components/client`.
- Scheduling/pricing math: update `src/domain/schedule.ts` and add focused tests.
- Analytics math: update `src/domain/analytics.ts` or `src/domain/chart-scale.ts` and add focused tests.
- Database schema/RLS/RPC: add a migration and update `src/lib/database.types.ts`.
- Email content: update `src/emails` and preview via `/email-preview` when running the app.
- Push behavior: keep subscription APIs, `public/sw.js`, `src/server/notifications.ts`, and `src/server/push-payloads.ts` in sync.
- Appointment outcome automation: keep `src/server/appointment-outcomes.ts`, `/api/cron/reminders`, `vercel.json`, and the supporting Supabase index in sync. The sweep runs once per day, so appointments are auto-completed the next morning, not within minutes of ending.
