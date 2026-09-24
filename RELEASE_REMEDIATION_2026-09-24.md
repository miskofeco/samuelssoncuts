# Release audit remediation — 24 September 2026

This tracks code changes made after `RELEASE_AUDIT_2026-09-24.md`. The audit remains the original snapshot. These fixes are in the local checkout only; migrations `0043`–`0046` have **not** been applied to the live Supabase project, and the app has not been deployed. Deploy the migrations in order before the code that calls their new RPCs or reads `appointments.price_cents` and `appointments.note`.

## Implemented locally

| Audit IDs | Change |
| --- | --- |
| F01, F02, F29 | Proposal response validates `auth.uid()` and the selected proposal, checks the actual barber's window/hours/blocks inside the RPC, and removes unnecessary anonymous function grants. Push persistence constraints and trigger-function grants are hardened in `0043`. |
| F03, F04 | Browser push endpoints are restricted to supported HTTPS providers at API, database and send boundaries; registrations and device fanout are capped. Existing browser subscriptions rebind on authenticated activity, and sign-out removes account subscriptions. |
| F05 | The Supabase auth-email hook fails when mail delivery fails and sends secure email-change hashes to the matching old/new addresses. |
| F06 | Avatar objects are removed before one service-role database transaction deletes a client's bookings and auth user. A database failure rolls back booking deletion. |
| F08 | Availability actions reject conflicting confirmed appointments; database triggers in `0045` take a common barber lock and enforce appointment/block/hour consistency across competing writes. |
| F07, F09, F11 | Partial-day blocks use exact overlap; appointment duration comes from stored endpoints, inactive booked services remain identifiable, and quotes/revenue retain cents. |
| F10, F12 | Appointments snapshot price and note; registered manual bookings get a confirmed backing request, client confirmation and a working reschedule lifecycle. Walk-ins remain request-free. |
| F13, F14 | Client rescheduling explicitly requires acknowledgment that the existing slot is cancelled immediately. Reopened requests clear stale proposal selection, and confirmed history uses the actual appointment. |
| F15, F16, F21 | Proposal replacement is transactional and limited to the acceptable window; ended appointment outcomes can be corrected through the admin UI. |
| F17, F18 | Reminder runs can retry eligible same-day appointments, recheck status/start before sending, and release their own failed claim. Expired sent proposals transition their parent requests out of active state. |
| F19, F20 | Reschedule options/feedback reflect the 24-hour rule and own slot; admin add/move options use configured hours, exact blocks and appointment overlap in the calendar and overview. |
| F22 | Core admin analytics/calendar, client reservations/history, client directory, blocked ranges, calendar exports and booking availability advance through the Data API row cap. Reads fail instead of returning partial data on a later-page error. |
| F24–F27 | Visible admin attention counts have a 30-second fallback and relevant open lists refresh; upload request size allows the advertised 3 MiB files; calendar-feed read errors return 503; date/time input rejects impossible values. |
| F30, F31, F34, F36 | Patched `brace-expansion` dependency and lockfile; terms reflect the self-service policy, signup links to legal pages, the user-provided public shop phone/address are included; admin page headings, weekday time-field names and calendar screen-reader labels improve; architecture version and flows are updated. |
| Client VIP pricing follow-up | Every client slot starting at or after 17:00 now takes the barber-configured VIP surcharge even when it directly connects to a confirmed booking. The picker and server quote use the same price kind; saved requests and reschedules carry the surcharge flag. |
| Manual booking price follow-up | The admin booking form now suggests the client-equivalent base, gap or VIP quote and lets the barber enter an exact custom euro amount. Migration `0046` atomically snapshots that price on the appointment and the registered client's backing request. |

## Still requiring work or release validation

- **F06:** Storage deletion is outside the database transaction. If it succeeds and the later database operation fails, the account and bookings remain but its avatar may be gone. Define retention/anonymization for historical revenue and notification of the barber when future bookings are erased. Test deletion against a full Supabase staging project with real Storage ownership.
- **F08:** Migration `0045` supplies a common database serialization boundary. Staging-test two concurrent sessions against full Supabase permissions and resolve conflicting future bookings/blocks already present in live data without silently cancelling customers.
- **F17/F18:** A process crash after a reminder claim can still suppress delivery, and proposal expiry's parent update is not one transaction. A durable outbox/lease and an atomic expiry RPC are needed for complete guarantees.
- **F22/F23:** The main operational reads no longer silently stop at the API row limit, but they still transfer large row sets. Replace growing analytics/history with aggregates or UI pagination and measure polling/query load with representative data. The audit viewer intentionally remains limited to 100.
- **F24/F28:** Client status pages and notification history/actions still need their own freshness/pagination work. Verify the admin fallback with two real sessions.
- **F29:** Compare final grants, policies and migrations with the deployed catalog after staging application; no live migration has been run here.
- **F31:** Review final legal text before public release. The public phone and address came from the user and are included as defaults; environment variables can override them.
- **F32/F33/F35:** Decide whether the launch is a private portal or a public acquisition flow; then address the public landing journey, client-management action hierarchy and readable/paged audit history.
- **F34:** The focused semantic/localization fixes do not replace a full keyboard, screen-reader, 200% text and light/dark contrast pass on desktop and phone.
- **F04/F05/F07/F12/F19/F20:** Exercise end-to-end in staging with approved-client, admin, shared-browser and real-device sessions. Source/unit/local-Postgres checks do not prove delivery-provider or PWA behavior.

## Verification

- `pnpm test`: 267 passed, 0 failed, including connecting-slot VIP and manual base/gap/VIP price regressions.
- `pnpm lint`: passed.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm build`: passed after the final UI edits.
- `pnpm audit --json`: 0 vulnerabilities after the lockfile update.
- Migrations `0043` and `0044`: applied in order to a disposable PostgreSQL 17 fixture; ownership, provider constraints, price backfill, manual booking/proposal transitions, stale proposal cleanup and deletion rollback were exercised. Migration `0045` and its block/hour/appointment guards passed an additional disposable embedded-Postgres fixture. Two-connection concurrency and a full Supabase staging replay remain necessary.
- Migration `0046`: exercised in a disposable embedded-Postgres fixture with the existing `0044` manual booking function. Registered-client and walk-in custom prices, request/appointment consistency, rollback on a failed request update, and service-role-only grants passed.
