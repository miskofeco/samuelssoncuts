# Samuelsson Cuts — pre-release audit

Audited 24 September 2026. Scope: architecture, security boundaries, booking correctness, operations, performance, UI, usability and customer acquisition. No application fixes or database mutations were performed.

**Release recommendation: hold a general customer release until the P1 findings are resolved.** The app has a coherent product interface and useful security foundations, but several ordinary workflows can lose booking state, misquote prices, fail to deliver authentication email, or leave users unable to complete an advertised action. There are also two important database/push security boundaries to close.

## Evidence and limits

- Reviewed `ARCHITECTURE.md`, routes, server actions, domain logic, shared/admin/client components, database migrations, configuration, email/push/calendar/cron flows and relevant tests.
- Inspected the existing local development app with an authenticated admin session and a separate signed-out session. Desktop and 390 × 844 phone layouts were sampled. Temporary viewport overrides were reset.
- Used **read-only** live Supabase catalog, function, policy, advisor and aggregate queries. The report intentionally omits customer identities and credentials.
- Ran the existing test suite, lint, production build and package audit. Used isolated local probes for SQL-null guard semantics, date normalization, interval-to-day conversion, mutable revenue, service fallback and push request construction.
- **No destructive exploit, real booking, cancellation, account deletion, email send or push delivery was executed.** Security conclusions distinguish source-confirmed weaknesses from untested network reachability.
- An authenticated approved-client session was not available. Client pages and interactions were reviewed in source, not signed off through a live client end-to-end journey. No real iOS/Safari PWA run, production load test, complete keyboard/screen-reader audit, dark-mode visual sweep, restore drill or delivery-provider failure injection was performed.
- This is a broad release audit, not proof that every possible defect has been found. Findings are anchored to the checkout and live state at audit time; line numbers will move as fixes land.

Evidence labels: **Observed** = rendered UI or live read-only state; **Confirmed** = direct implementation evidence; **Scenario** = a supported failure path not executed against live customer data; **Recommendation** = a product choice, not a proven defect.

## Verification results

| Check | Result | What it establishes |
|---|---|---|
| `pnpm test` | 239 passed, 0 failed | Current suite passes; many tests inspect source text rather than executing database/auth transitions |
| `pnpm lint` | Passed | No current lint violations |
| `pnpm build` | Passed | Production compilation and route generation succeed |
| `pnpm audit --json` | 3 high advisories, all on one tooling dependency path | `eslint → minimatch → brace-expansion`; see F30 |
| Supabase advisors | Security/performance warnings reviewed | Some are actionable hardening; some reflect intentional service-only/token-authenticated design |
| Impeccable detector | Unavailable | Local engine could not initialize; no automated detector score is claimed |

Local logs: `/tmp/samuelsson-audit-tests.log`, `/tmp/samuelsson-audit-lint.log`, `/tmp/samuelsson-audit-build.log`, `/tmp/samuelsson-dependency-audit.json`. These temporary files are supporting evidence, not durable release artifacts.

## Priority index

**36 findings: 0 P0, 16 P1, 18 P2, 2 P3.** P1 means fix before broad release; P2 means a bounded correctness, scale or usability problem to address in the following pass; P3 is polish/documentation. No catastrophic production outage or successful exploit was demonstrated.

| ID | Priority | Finding |
|---|---|---|
| F01 | P1 | Null client ID bypasses proposal ownership guards |
| F02 | P1 | Direct proposal RPC bypasses availability rules |
| F03 | P1 | Arbitrary push endpoints create an outbound-request security risk |
| F04 | P1 | Push subscriptions remain attached to a previous account |
| F05 | P1 | Authentication email failure is acknowledged as success |
| F06 | P1 | Account deletion can erase bookings and then fail |
| F07 | P1 | A partial-day block closes the entire day in the picker |
| F08 | P1 | Availability changes can contradict confirmed appointments |
| F09 | P1 | Booking duration and service identity depend on today's catalog |
| F10 | P1 | Historical manual-booking revenue changes with service prices |
| F11 | P1 | Supported fractional prices are rounded to whole euros |
| F12 | P1 | Manual bookings bypass essential parts of the booking lifecycle |
| F13 | P1 | Rescheduling releases the original confirmed slot immediately |
| F14 | P2 | Rescheduled requests can show an old proposal's date |
| F15 | P1 | Proposal creation is a non-atomic state transition |
| F16 | P1 | Automatic completion removes no-show correction controls |
| F17 | P1 | Reminder failures and late confirmations fall outside retry coverage |
| F18 | P2 | Expired proposals leave their requests active |
| F19 | P2 | Reschedule picker constraints and feedback do not match the action |
| F20 | P2 | Admin time options ignore configured opening hours and blocks |
| F21 | P2 | Admin can propose dates the client action rejects |
| F22 | P2 | Unpaginated reads can silently truncate operational data |
| F23 | P2 | Frequent polling reloads too much stable data |
| F24 | P2 | Attention badges and page contents have inconsistent freshness |
| F25 | P2 | Advertised 3 MB uploads exceed the framework's default request limit |
| F26 | P2 | Calendar-feed failures return a successful empty calendar |
| F27 | P2 | Date/time validation accepts impossible values |
| F28 | P2 | Notification actions and unread history are incomplete |
| F29 | P2 | Live database permissions and hardening need reconciliation |
| F30 | P2 | Three dependency advisories remain in development tooling |
| F31 | P2 | Policy/contact information does not match the product |
| F32 | P2 | Public acquisition journey hides the service before demanding an account |
| F33 | P2 | Client-management action hierarchy favors destructive administration |
| F34 | P2 | Accessibility semantics and localization need a focused pass |
| F35 | P3 | Audit history exposes implementation details instead of readable events |
| F36 | P3 | Architecture documentation has version drift |

## Security and account lifecycle

### F01 — P1: Null client ID bypasses proposal ownership guards

**Confirmed in source and live function definition.** `supabase/migrations/0032_security_hardening.sql:133`, particularly lines 149 and 167. `respond_to_appointment_proposal` compares the caller-supplied `p_client_id` using `<>`. With a null argument, SQL produces null, and PL/pgSQL `IF` does not take the rejection branch. Both the caller check and request-owner check can be skipped by an otherwise approved client.

**Impact:** an approved client who knows another client's sent proposal UUID can reach its decline/update path. UUID knowledge is a prerequisite; this audit did not demonstrate a way to enumerate other clients' proposal IDs. The server action supplies a real ID, but the authenticated role can invoke the RPC directly.

**Fix:** derive ownership from `auth.uid()` inside the function, reject null explicitly, use `IS DISTINCT FROM` where appropriate, and verify that the parent request and selected proposal are still actionable. Add role-based database tests for null, another owner's proposal, expired/old proposals and unauthenticated callers. No live exploit was attempted.

### F02 — P1: Direct proposal RPC bypasses availability rules

**Confirmed.** The same RPC in `0032_security_hardening.sql:133` checks proposal status/future time and appointment overlap, but does not enforce blocked intervals, current business hours or the application's booking horizon. Those checks live in `src/app/actions.ts:1770` and can be bypassed by calling the RPC directly.

**Scenario:** a legitimate client accepts their existing proposal after the barber has blocked that time. The database's appointment-overlap exclusion still protects appointment-versus-appointment conflicts; this finding is specifically about the other scheduling rules.

**Fix:** put all confirmation invariants into the transaction that inserts the appointment, or restrict this RPC to a carefully validated server-only boundary. Verify acceptance after a block/hours change and concurrent availability changes.

### F03 — P1: Arbitrary push endpoints create an outbound-request security risk

**Confirmed input/delivery gap; network exploitability untested.** `src/app/api/push/subscriptions/route.ts:12` accepts any URL; the live upsert RPC and own-row write policies do not constrain provider destinations. `src/server/notifications.ts:174` passes the saved endpoint to `webpush.sendNotification` without a destination policy or explicit timeout. Subscription count/rate limits are also missing at this boundary.

An isolated `web-push.generateRequestDetails` probe accepted an HTTPS loopback URL with valid generated keys. It constructed a request only; no internal address was contacted. An authenticated account can therefore store destinations that are not browser push providers, creating an SSRF/egress and resource-exhaustion risk when delivery runs.

**Fix:** validate supported HTTPS push-provider origins at both persistence and delivery, disallow private/internal destinations, bound subscriptions per account and registrations per interval, and configure delivery timeouts. Cover direct database writes as well as the HTTP route. Verify with a mocked transport and controlled staging network tests.

### F04 — P1: Push subscriptions remain attached to a previous account

**Confirmed scenario.** `src/app/actions.ts:528` signs out without detaching the device subscription. `src/components/shared/push-notification-card.tsx:87` treats any existing browser subscription as enabled without rebinding it to the current authenticated account. Rebinding occurs only in the explicit enable flow.

**Impact:** on a shared browser, account B can see push as enabled while the endpoint is still bound to account A. A's booking notifications can reach the same device after the account switch, and B's can be missed.

**Fix:** define a device/account ownership lifecycle: detach on logout and reconcile the existing subscription on authenticated mount. Preserve the user's opt-in choice. Test A → logout → B on one browser, plus account deletion, blocked access and expired sessions.

### F05 — P1: Authentication email failure is acknowledged as success

**Confirmed.** `src/lib/email.ts:34` returns `false` for provider errors or absent configuration. `src/app/api/auth/send-email/route.ts:113` ignores that result and returns HTTP 200. Its catch block does not handle ordinary failures because `sendEmail` catches them internally.

**Impact:** signup verification and recovery messages can silently vanish while Supabase considers the hook successful. This is more serious than a best-effort booking notification.

**Fix:** explicitly fail the authentication hook when delivery returns false; validate required production configuration; retain safe error reporting. Inject a provider rejection and missing-key case and assert a non-success response. See [Supabase's Send Email Hook contract](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook).

### F06 — P1: Account deletion can erase bookings and then fail

**Confirmed sequence; failure not executed.** `src/app/actions.ts:969` and `:2873` delete appointments and requests before `auth.admin.deleteUser`. Neither path removes owned avatar storage objects first. Supabase documents that users owning Storage objects cannot be deleted. Read-only inspection found three avatar objects with owners in the live project. [Supabase user-management documentation](https://supabase.com/docs/guides/auth/managing-user-data).

**Impact:** an account with an avatar can lose its bookings/history and still remain undeleted. More generally, each successful step commits before a later failure. Self-deletion also removes future appointments without the normal cancellation notification workflow and removes data underlying financial history.

**Fix:** design an idempotent deletion workflow covering storage, auth, bookings, notifications and agreed retention. Preflight predictable blockers, record progress, and make retries safe. Decide how upcoming bookings and anonymized historical revenue are handled. Inject failures at every step in staging; verify an avatar-owning user can complete erasure without silent partial loss. This is an engineering finding, not a legal-compliance opinion.

## Booking correctness, money and operations

### F07 — P1: A partial-day block closes the entire day in the picker

**Confirmed; live partial-day rows exist.** `src/server/dashboard-data.ts:304` reduces blocked timestamp intervals to a set of dates through `eachDate`. `src/components/client/slot-picker.tsx:208` and `:223` reject the entire date. The blocked-time listing also loses useful time-of-day information.

**Example:** a lunch block from 12:00–13:00 marks the whole day unavailable to clients. A local probe confirmed that interval becomes a single fully blocked date. Three live block rows had non-midnight boundaries; this is not merely an unsupported hypothetical data shape.

**Fix:** preserve interval endpoints in domain data and evaluate overlap with each candidate slot. Reserve all-day state for actual full-day closure. Verify lunch breaks, a booking ending exactly at a block boundary, multi-day blocks and timezone/DST boundaries.

### F08 — P1: Availability changes can contradict confirmed appointments

**Confirmed and observed in live aggregate data.** `src/app/actions.ts:2339` inserts a block without checking existing confirmed appointments. `:2538` updates business hours without an impacted-bookings workflow. One upcoming confirmed appointment overlapped a blocked interval at audit time; the calendar also displayed a confirmed booking on a closed day.

**Impact:** the app simultaneously promises a confirmed booking and says the barber is unavailable. Customers receive no resolution merely because availability was edited.

**Fix:** preview affected bookings before saving a conflicting closure; require the barber to resolve them or explicitly retain them as exceptions. Do not silently cancel them. Validate concurrency in the database boundary, and ensure calendar, client view and notifications agree afterward.

### F09 — P1: Booking duration and service identity depend on today's catalog

**Confirmed.** `src/server/dashboard-data.ts:113` and `:195` drop stored `ends_at` from mapped appointments. `src/components/client/slot-picker.tsx:51` reconstructs duration from the current service. `src/domain/schedule.ts:206` silently substitutes the first service when an ID is missing. Client service visibility excludes inactive services.

**Scenarios:** changing a service from 45 to 60 minutes changes the UI's interpretation of existing 45-minute appointments; hiding a service can make its old bookings display another service or an incorrect duration. No current live duration mismatch was found in the aggregate check; the mutation scenario remains a release risk.

**Fix:** carry stored start/end times throughout scheduling and calendar rendering. Preserve the booked service's historical identity, and separate public catalog visibility from permission to read the service attached to one's booking. Never silently replace a missing service with a different one. Test edits and deactivation with existing appointments.

### F10 — P1: Historical manual-booking revenue changes with service prices

**Confirmed with a local calculation probe.** `src/domain/analytics.ts:143` uses the linked request's captured price when present, otherwise today's service price. Manual appointments have no request. Changing the catalog price changed the same historical appointment's calculated revenue from €20 to €30 without changing the appointment.

**Fix:** persist the agreed price in cents for every appointment, including walk-ins and manually created registered-client bookings. Snapshot relevant price components; do not reconstruct historical surcharges from current settings. Define a careful legacy backfill, explicitly marking unknown values. Verify historical reports remain stable after catalog/pricing edits.

### F11 — P1: Supported fractional prices are rounded to whole euros

**Confirmed.** `src/components/admin/service-manager.tsx:375` accepts €0.50 increments and saves cents. `src/server/dashboard-data.ts:131` and `src/server/booking-pricing.ts:89` round the base price to whole euros. A €20.50 configured service becomes €21 in display/quotation paths.

**Fix:** use integer cents throughout pricing, round only the final calculated cent amount using an explicit rule, and format currency at display time. Test €20.50 with no surcharge and with each surcharge type. If whole-euro pricing is intentional, the editor must enforce it rather than silently changing an accepted price.

### F12 — P1: Manual bookings bypass essential parts of the booking lifecycle

**Confirmed.** `src/app/actions.ts:1675` inserts `request_id: null` for both walk-ins and registered clients, ignores the parsed note, sends no booking notification/email, and revalidates only admin pages. The client check accepts any non-admin profile, including pending/blocked clients.

Both admin rescheduling (`actions.ts:1460`) and client rescheduling (`0034_shop_barber_rescheduling.sql:86`) require a request. A manually booked registered client is therefore offered a workflow that fails because the required backing request does not exist.

**Fix:** define a complete manual-booking path with supported rescheduling, immutable price, persisted note and notification behavior. Choose and enforce the policy for unapproved clients. Test registered client, walk-in, blocked client, reschedule, cancellation and client visibility as one lifecycle.

### F13 — P1: Rescheduling releases the original confirmed slot immediately

**Confirmed.** `supabase/migrations/0034_shop_barber_rescheduling.sql:86` cancels the current appointment before reopening its request as pending. `src/components/client/confirmed-appointment-actions.tsx:149` says the barber will confirm the new time but does not clearly explain that the old confirmed slot is immediately lost.

**Impact:** if the barber declines the new request, the client can end up with neither appointment. The old slot can meanwhile be taken by someone else.

**Fix:** preferably keep the old booking until an atomic replacement is approved. If immediate release is the intended business rule, obtain explicit informed confirmation and show the before/after state and new price. Test rejection and competing bookings during the pending change.

### F14 — P2: Rescheduled requests can show an old proposal's date

**Confirmed scenario.** `0034_shop_barber_rescheduling.sql:153` updates the reopened request without clearing `selected_proposal_id`. `src/components/client/reservation-list.tsx:221` prefers any selected proposal's date/time when the request is confirmed, even if that proposal is no longer the current appointment.

**Impact:** a booking originally confirmed through a proposal, then client-rescheduled and confirmed at the requested time, can show the old proposal's date in request history.

**Fix:** clear obsolete proposal linkage on reopening and render confirmed time from the actual confirmed appointment. Test proposal acceptance → client reschedule → exact-slot confirmation and compare every displayed date.

### F15 — P1: Proposal creation is a non-atomic state transition

**Confirmed race/failure path, not concurrency-tested live.** `src/app/actions.ts:1079` reads request status, expires the previous proposal, inserts another, then unconditionally changes the parent request to proposed. Some write errors are ignored. These are independent network/database operations.

**Impact:** a concurrent cancellation/confirmation can be overwritten by the late parent update; a failed insert can leave the earlier proposal expired without a valid replacement. The unique sent-proposal constraint does not make the parent transition atomic.

**Fix:** perform proposal replacement and parent-state validation in one transaction under a row lock, with allowed transitions and all errors propagated. Race proposal creation against cancel/confirm and inject failure between steps. Review other multi-write actions, particularly client blocking, for the same partial-success pattern.

### F16 — P1: Automatic completion removes no-show correction controls

**Confirmed.** `src/server/appointment-outcomes.ts:12` marks ended appointments completed after the grace period when cron runs. `src/components/admin/appointment-detail-modal.tsx:182` offers outcome controls only when no outcome exists; `:94` also restricts management once an outcome exists.

**Impact:** after automatic completion, the barber cannot use the UI to correct a missed appointment to no-show. Attendance and revenue become wrong even though the server action supports outcome updates.

**Fix:** distinguish inferred completion from barber-confirmed attendance, or allow audited corrections for completed/no-show states. Verify the day-after workflow after cron has already run.

### F17 — P1: Reminder failures and late confirmations fall outside retry coverage

**Confirmed scheduling gap.** `src/app/api/cron/reminders/route.ts:132` selects only the next-day window. On failure, `:185` resets the claim for a supposed future retry, but the next daily run selects a different day. A booking confirmed after today's sweep can also miss its reminder entirely.

The claim at `:162` checks only ID and an empty reminder stamp, not current status/start time. A cancellation or reschedule between selection and claim can produce a stale reminder. A crash after claiming can leave a permanent stamp without delivery.

**Fix:** model due deliveries explicitly with retry state, eligibility rechecks and idempotency. Respect the deployment plan's cron limits when choosing the worker strategy. Verify provider failure, late confirmation, cancellation/reschedule during processing and a crash after claim. The daily barber agenda also needs an explicit duplicate-send policy for reruns.

### F18 — P2: Expired proposals leave their requests active

**Confirmed.** `src/server/appointment-outcomes.ts:34` declines only pending requests, then expires sent proposals. It does not transition parent requests already in proposed state. The client mapper converts expired proposals to declined while active request filters still include proposed requests.

**Impact:** a request can remain in active/needs-action lists indefinitely with no live proposal to accept.

**Fix:** expire the selected proposal and transition its parent consistently in a transaction. Test the client and admin lists immediately after the expiry job, including replacement proposals and already-confirmed requests.

## Interface behavior and performance

### F19 — P2: Reschedule picker constraints and feedback do not match the action

**Confirmed in source; approved-client rendering not exercised.** `src/components/client/confirmed-appointment-actions.tsx:178` uses the normal booking picker without the action's 24-hour reschedule minimum, keeps the current appointment among busy slots, and lacks the fresh availability/invalid-selection handling used by the main booking flow. Its general `Feedback` is outside the reschedule modal; the in-modal feedback at line 143 belongs to cancellation.

**Impact:** clients can select an option that will be rejected, receive a price influenced by their own old appointment, or have the error hidden behind the open modal.

**Fix:** share explicit constraints and current-appointment exclusion between picker and action; refresh availability; show errors and the new price inside the reschedule dialog. Test the 24-hour boundary, stale slot, own-slot adjacency, and server failure on phone and desktop. Suggested UI pass: `$impeccable harden`.

### F20 — P2: Admin time options ignore configured opening hours and blocks

**Confirmed and reflected in the observed calendar controls.** `src/domain/schedule.ts:337`, `src/components/admin/add-booking-modal.tsx:102`, and `appointment-detail-modal.tsx:100` build options from fixed hours and appointment occupancy rather than actual business hours/blocked intervals. The calendar still exposes adding a booking on a closed day.

**Impact:** the barber selects apparently valid options only to be rejected by the server. Configured hours outside the fixed option range are not represented correctly.

**Fix:** reuse the same availability model as server validation; disable unavailable options with an explanation, or clearly distinguish a deliberate override if the product supports one. Test custom opening hours and a lunch block. Suggested pass: `$impeccable harden`.

### F21 — P2: Admin can propose dates the client action rejects

**Confirmed.** `src/app/actions.ts:1079` validates that a proposed start is in the future but does not apply the client's two-week horizon. `respondToProposalAction` applies that horizon when accepting.

**Impact:** the barber can send an offer that the client cannot immediately accept through the normal UI.

**Fix:** either constrain proposal creation to the same window, or explicitly allow accepting barber proposals beyond the self-booking window. Align UI, server and RPC rules and test the exact horizon boundary.

### F22 — P2: Unpaginated reads can silently truncate operational data

**Confirmed query shape; threshold is deployment-dependent.** `src/server/dashboard-data.ts:631`, `:685`, `:751` and client/history loaders use broad selects without complete pagination. A 13-month date bound is not a row bound. Supabase projects default to at most 1,000 returned rows; the actual project's API row-limit setting was not verified. [Supabase select reference](https://supabase.com/docs/reference/javascript/v1/select).

**Impact:** as data grows, analytics can undercount and lists/calendars can omit relevant appointments or clients without an error. Four appointments per day already exceed 1,000 over a year. This was not reproduced with production-size data.

**Fix:** use server-side aggregates for analytics, paginate directories/history, and explicitly retrieve complete bounded availability sets. Add >1,000-row fixtures and assert totals and future appointment visibility. Suggested performance pass: `$impeccable optimize`.

### F23 — P2: Frequent polling reloads too much stable data

**Confirmed; load impact estimated, not benchmarked.** `src/components/client/request-form.tsx:104` polls every eight seconds, and `src/components/admin/admin-calendar.tsx:181` every twenty seconds. Their loaders also fetch profile/context, blocked times, settings/hours, roster/catalog or other data that changes much less often.

**Impact:** 100 visible booking pages imply roughly 750 availability requests per minute before counting each request's database work. Repeatedly transferring the admin roster also increases payload and parsing cost.

**Fix:** keep a small fresh availability response, cache stable context safely, return only visible-window data, and add backoff/failure visibility. Preserve current visibility-aware behavior. Measure query count, response bytes and latency before/after with representative data. Suggested pass: `$impeccable optimize`.

### F24 — P2: Attention badges and page contents have inconsistent freshness

**Confirmed.** `src/hooks/use-realtime-badge.ts:8` watches profiles, while `supabase/migrations/0042_realtime_publication.sql` deliberately excludes profiles from realtime to protect sensitive fields. The hook has visibility/online fallback but no periodic fallback while the page stays visible. Badge updates intentionally do not refresh the request/approval lists. Several client status pages also rely on navigation/refresh rather than incoming updates.

**Impact:** a barber can miss a newly verified applicant or see a badge change while the open list remains stale; a client can keep seeing an obsolete booking status.

**Fix:** retain the security restriction on profiles. Publish a safe attention signal or use a lightweight polling fallback, and explicitly refresh/invalidate affected visible lists. Show freshness/retry state. Test two sessions with no manual navigation. Suggested pass: `$impeccable harden`.

### F25 — P2: Advertised 3 MB uploads exceed the framework's default request limit

**Confirmed configuration mismatch.** `src/app/actions.ts:2010` and `:2264` allow 3 MB images; `next.config.ts` does not raise the Server Action body limit. The installed Next.js guide documents a 1 MB default (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md:59`).

**Impact:** valid advertised uploads over the request limit are rejected before the action's friendly validation runs.

**Fix:** reconcile client guidance, action validation and transport limits, allowing multipart overhead; preferably resize/compress client images appropriately. Test just below/above both limits for avatar and service images. Suggested pass: `$impeccable harden`.

### F26 — P2: Calendar-feed failures return a successful empty calendar

**Confirmed.** `src/app/api/calendar/feed/[token]/route.ts:53` logs an RPC error, replaces rows with an empty array, and returns HTTP 200.

**Impact:** subscribed calendar applications may interpret a transient backend failure as removal of all events.

**Fix:** return a retryable failure for actual data errors; reserve a successful empty calendar for a valid empty result and consciously defined revoked-token behavior. Test RPC failure separately from zero bookings and token revocation.

### F27 — P2: Date/time validation accepts impossible values

**Confirmed with a local probe.** Multiple schemas in `src/app/actions.ts:91` onward validate only the shape `YYYY-MM-DD` / `HH:MM`. Date conversion can normalize impossible dates: `2026-02-31` became March 3 in the isolated probe. Invalid calendar query parameters can also reach formatting code.

**Fix:** validate real calendar dates and time ranges before conversion, enforce expected time increments where relevant, and reject instead of normalizing. Test leap days, `24:00`, `99:99`, malformed query parameters and DST transitions.

### F28 — P2: Notification actions and unread history are incomplete

**Confirmed.** `src/components/client/notification-list.tsx:101` renders an action only for reservation URLs, so a notification linking to `/client/book` has no equivalent in-app CTA. `src/server/dashboard-data.ts:355` defaults to the latest 30 notifications, while `src/app/client/notifications/page.tsx:14` enables “mark all read” based only on that slice.

**Impact:** an older unread notification can keep the navigation badge nonzero while the visible list has no enabled way to clear it. Booking-recovery messages lose their intended next action.

**Fix:** use a safe allowlist of supported internal destinations, derive unread controls from the full unread count, and provide paging or a clear all-history action. Test 31+ notifications with only an old one unread. Suggested pass: `$impeccable harden`.

## Hardening, product clarity and polish

### F29 — P2: Live database permissions and hardening need reconciliation

**Observed live warnings and grants.** Advisors identified mutable search paths on `touch_updated_at` and `normalize_phone`, `btree_gist` in public, and callable security-definer functions. Live anonymous execute grants on some cancellation RPCs differ from the intended revokes in earlier repository migrations. Their internal auth checks still reject anonymous callers; this is **not** evidence of anonymous booking cancellation.

**Fix:** reconcile applied migrations and final grants, use least-privilege execute permissions, set safe search paths, and assess extension-schema changes against dependencies. Test a clean migration replay and compare its catalog to the deployed project. Treat trigger functions and the intentionally token-authenticated calendar feed separately. The service-only rate-limit table having no client RLS policy is intentional, not a vulnerability. Multiple-permissive-policy and unused-index warnings require query evidence before changing them. [Supabase database linter](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).

### F30 — P2: Three dependency advisories remain in development tooling

**Observed from `pnpm audit`.** All three high advisories resolve through `eslint → minimatch → brace-expansion` at 1.1.15. The reported patched floors are 1.1.16, 1.1.17 and 1.1.18 respectively; use a compatible version satisfying all three. The existing newer-major override does not cover this 1.x path.

**Fix:** update the affected chain or add a narrowly compatible override, regenerate the lockfile, and rerun audit/lint/build. These are denial-of-service advisories in a lint-tooling path; this audit did not establish a remotely reachable application exploit. Details: [exponential expansion](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp), [unbounded expansion](https://github.com/advisories/GHSA-mh99-v99m-4gvg), [intermediate-array exhaustion](https://github.com/advisories/GHSA-rgw5-rvv9-x895).

### F31 — P2: Policy/contact information does not match the product

**Observed and source-confirmed.** `/terms` says confirmed bookings must be changed/cancelled by contacting the barber, whereas the application offers client self-service before a 24-hour cutoff. `/privacy` and `/terms` tell visitors to contact the shop but show no concrete contact method in the rendered text. The registration form has no visible link to these policies. Shop phone/address and the auth-email hook secret are not documented comprehensively in `.env.example`.

**Impact:** customers cannot reliably understand the cancellation rule or find help, especially before they have successfully booked. Operators can miss configuration needed by contact/email flows. Privacy/export/deletion promises should also be reconciled with the actual retained data and erasure workflow in F06.

**Fix:** write one accurate cancellation/reschedule policy, link relevant policies at signup, provide real shop contact details, and document required/optional production variables. Obtain an appropriate policy review without claiming this audit certifies legal compliance. Suggested pass: `$impeccable clarify`.

### F32 — P2: Public acquisition journey hides the service before demanding an account

**Recommendation conditional on launch audience.** `src/app/page.tsx` routes unauthenticated visitors into login. Before seeing the service catalog/price/availability in the app, a new customer encounters account creation, email verification and barber approval, followed by approval of a booking request. The observed login describes a “planner” rather than clearly introducing the barber service.

**Impact:** this is a reasonable private portal for existing clients, but a high-friction acquisition journey for a publicly promoted booking site. No conversion loss was measured.

**Fix:** decide explicitly whether this is an invitation-only client portal or a new-customer funnel. For public acquisition, add a concise public service/price/location/hours page, authentic work photos and genuine trust signals, explain approval timing, and make the booking/request CTA clear. Do not invent reviews or claims. Add privacy-respecting funnel measurement only if wanted. Suggested pass: `$impeccable onboard`.

### F33 — P2: Client-management action hierarchy favors destructive administration

**Observed on desktop and phone.** The client-detail view gives block/delete actions prominent space while lacking an equally direct “book for this client” workflow. The directory's email column communicates verification status while the email address lives under the name. The overview also devotes substantial upper-page space to an empty current-booking area before some pending work.

**Impact:** common tasks require more navigation, destructive controls receive disproportionate attention, and labels slow scanning. Confirmation dialogs exist; this is not a claim that a single accidental tap immediately deletes an account.

**Fix:** prioritize next appointment, book, contact and relevant history; move infrequent destructive actions into a clearly separated menu/section. Rename the verification column and prioritize pending work when today's schedule is empty. Suggested pass: `$impeccable layout`.

### F34 — P2: Accessibility semantics and localization need a focused pass

**Observed/code-confirmed, not a full WCAG audit.** Several admin routes expose section headings as H2 without a page H1; `/admin/audit` lacks a useful visible page heading. Calendar controls include default English accessible labels in the Slovak interface. Repeated business-hours “from/to” labels lack the weekday in their accessible name. Phone registration has good 44 px primary actions, but the password-visibility target measured 32 px.

**Impact:** page/field navigation is less clear with assistive technology, language output is inconsistent, and small secondary targets are harder to use. A 32 px target alone is not proof of a WCAG 2.2 AA violation; the stricter 44 px project/design target and actual spacing must be distinguished.

**Fix:** add route titles, contextual field names and translated calendar labels; enlarge appropriate hit areas; verify keyboard/focus/error announcement behavior. Run measured contrast checks in both themes and 200% text scaling before claiming accessibility compliance. Suggested passes: `$impeccable harden`, `$impeccable adapt`.

### F35 — P3: Audit history exposes implementation details instead of readable events

**Observed.** `src/app/admin/audit/page.tsx` renders events such as `appointment.create`, raw UUIDs and JSON details. On phone, these wrap into tall cards. Only the latest 100 entries are shown without a retrieval path to older entries.

**Impact:** the barber must translate database concepts to understand who changed which booking, and older investigations become difficult.

**Fix:** show localized human-readable summaries, affected customer/appointment links where permitted, and expandable technical details; add search/date paging when operationally needed. Suggested pass: `$impeccable clarify`.

### F36 — P3: Architecture documentation has version drift

**Confirmed.** `ARCHITECTURE.md` describes Next.js 16.2.9 while the audited installation is 16.3.5. The document remains useful, but the project explicitly depends on version-specific local guidance.

**Fix:** update factual version references when dependency changes land and keep route/data-boundary descriptions synchronized with the remediation work. Document the intended booking state machine, manual-booking policy and reminder retry behavior. Suggested documentation pass: `$impeccable document` for UI-system decisions; architecture updates should remain in `ARCHITECTURE.md`.

## Page sweep coverage

“Source” means implementation reviewed; it is not a claim that every modal/state was visually executed. Browser visits were read-only. Registered-client behavior requires a separate approved-client staging run before release.

| Surface | Coverage | Main follow-up |
|---|---|---|
| `/`, `/dashboard` | Source/redirect behavior | Public entry strategy, F32 |
| `/login` | Desktop browser + source | Recovery delivery; clearer service-oriented introduction |
| `/register` | Desktop/phone browser + source | Policy links/contact; approval expectation; F05, F31–32 |
| `/reset-password` | Desktop browser + source | Failed delivery must not be reported as sent |
| `/auth/update-password`, auth callback/confirm | Source | Real recovery/OAuth link journey still needs staging E2E |
| `/complete-profile`, `/pending`, `/setup` | Source | Pending/rejected/blocked and bootstrap-state E2E still required |
| `/privacy`, `/terms`, `/cookies` | Browser text + source | Align policy, contact and actual functionality |
| `/admin` | Desktop browser + source | Stable analytics/attendance; pending-work hierarchy |
| `/admin/calendar` | Desktop/phone browser; add dialog; source | Intervals, duration, closed-day behavior, manual lifecycle |
| `/admin/requests` | Phone populated/empty browser states + source | Atomic proposals, expiry, freshness, horizon |
| `/admin/approvals` | Browser accessibility state + source | New-applicant refresh and pending/blocked policies |
| `/admin/availability` | Desktop/phone browser + source | Partial-day representation; affected confirmed appointments |
| `/admin/clients` | Desktop browser + source | Pagination and verification labels |
| `/admin/clients/[clientId]` | Desktop/phone browser + source | Daily-task hierarchy; deletion lifecycle |
| `/admin/settings` | Desktop accessibility state/phone visual + source | Price precision, upload limits, historic catalog effects |
| `/admin/audit` | Phone browser + source | Human-readable events and older history |
| `/client` | Source | Status freshness, historical identity and next-step accuracy |
| `/client/book` | Source + isolated scheduling probes | Partial blocks, exact durations/prices, polling volume |
| `/client/reservations` | Source | State transitions, stale selected proposal, expiry |
| `/client/reservations/[id]` | Source | Manual bookings, inactive service, reschedule feedback |
| `/client/notifications` | Source | Older unread entries and actionable links |
| `/client/profile` | Source | Push owner lifecycle, uploads, erasure/export consistency |
| Error/not-found, email preview, manifest/service worker | Source | Real failure/offline/install/device behavior not signed off |
| API routes: attention/calendar/availability/push/auth/cron/ICS | Source; live DB boundaries read-only | Findings above; failure injection and concurrency E2E outstanding |

## UI technical health

**Implementation-integrity verdict: fail for release readiness; coherent visual system worth preserving.** The interface is consistent and recognizably a barber scheduling product. The failure is in action/state contracts: a visible control can promise a result that the backing lifecycle cannot deliver. No broad visual rewrite is justified by this audit.

These are provisional review scores, not measured WCAG or performance certification. The automated design detector was unavailable, and dark-theme/device coverage was limited.

| Dimension | Score / 4 | Evidence |
|---|---:|---|
| Accessibility | 2 | Accessible primitives and labels exist; contextual naming, page titles and complete keyboard/contrast validation remain |
| Performance | 2 | Date bounds, some caching/lazy loading exist; broad polling and incomplete pagination remain |
| Responsive design | 3 | Tested phone screens fit and primary registration actions are 44 px; further text-scale/modal-state coverage needed |
| Theming | 3 | Semantic token system is present; full dark-theme visual verification was not performed |
| Implementation integrity | 2 | Shared patterns are coherent; multiple action/state mismatches remain |
| **Total** | **12 / 20** | **Significant work needed; visual score does not override security/booking blockers** |

## What to preserve

- Database exclusion constraints protect confirmed appointment overlap, and several critical mutations already use transactional RPCs.
- Server-only Supabase administration and secret boundaries, approval checks, RLS, input schemas and rate limits are established patterns.
- Nonce-based CSP and baseline response headers are present.
- Shared modal/navigation/components, semantic tokens and localization provide a solid interface foundation. The phone shell and sampled layouts generally fit well.
- Pure domain helpers and central row mapping make focused corrections practical.
- Tests, lint and production build are clean. The task is to extend behavioral confidence and close the listed gaps, not replace the entire architecture.

## Architectural causes and recommended sequence

The recurring causes are duplicated scheduling rules across UI/actions/RPCs; mutable catalog data used as historical booking facts; incomplete transitions among requests, proposals and appointments; and best-effort side effects without durable delivery state. A larger rewrite would add risk. Repair these boundaries incrementally within the current project structure.

1. **Secure boundaries:** F01–F06 and F29. Add database role/null-argument tests and push/auth failure tests first. Reconcile deployed grants with migrations.
2. **Make booking facts and transitions authoritative:** F07–F16 and F18/F21. Preserve exact intervals and cents; complete manual booking and rescheduling; move multi-step transitions into transactions.
3. **Make delivery reliable:** F17/F26/F28. Add due/retry/idempotency state and verify failures, not only successful sends.
4. **Align interface with server rules:** F19/F20/F24/F25/F27. Use `$impeccable harden`, then `$impeccable adapt` for phone dialogs and target sizes.
5. **Prove scale:** F22/F23/F30. Use `$impeccable optimize`; benchmark representative large data instead of assuming a time window guarantees completeness.
6. **Clarify customer/operator journeys:** F31–F35. Use `$impeccable clarify`, `$impeccable layout` and, if public acquisition is intended, `$impeccable onboard`.
7. **Finish:** update architecture documentation, run `$impeccable audit`, then `$impeccable polish` after correctness fixes.

## Release acceptance checks

- Database tests as anonymous, pending, approved client A, approved client B and admin; include null arguments and direct RPC calls.
- Two simultaneous confirmations for one slot; proposal replacement racing cancellation; block/hours change racing acceptance. Assert one coherent final state and no orphaned active request.
- Partial-day blocks, stored-duration changes, inactive services, fractional prices and immutable historical revenue.
- Both manual-booking types through create → notify → view → reschedule → cancel/outcome.
- Rescheduling through accepted proposal → new request → confirmation/rejection; assert old/new slot policy and displayed dates everywhere.
- Reminder provider failure, late confirmation, process interruption and safe retries; auth-email false result; feed RPC failure.
- Shared-browser push ownership; avatar-owning account deletion with staged failures and safe retries.
- More than 1,000 appointments/requests/clients; 31+ notifications; compare exact expected totals and visible future data.
- Approved-client and admin browser journeys on phone and desktop, including failure feedback inside dialogs, keyboard focus, text zoom and both themes.
- Real-device installed-PWA checks for permission denial, account switching, stale subscriptions and notification clicks. Measure production web vitals and confirm monitoring/backup recovery separately.

The current 239 tests are useful but not sufficient evidence for these cases: a number assert that source strings exist. Add behavioral tests around changed boundaries rather than more regex assertions that mirror implementation. Use focused tests first, then the full test/lint/build checks after the corrective changes.

You can ask for these fixes one at a time, in grouped releases, or in a different order. Re-run the audit after fixes to update the findings and evidence rather than treating this report as a permanent score.
