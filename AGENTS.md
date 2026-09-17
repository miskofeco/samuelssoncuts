<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Architecture

Read `ARCHITECTURE.md` before planning or editing code. Use it as the project map for routes, data flow, auth, server actions, Supabase boundaries, notifications, and verification expectations. Still inspect the current files you will touch; the architecture document is a guide, not a source-code replacement.

When you change an architectural part of the project, update `ARCHITECTURE.md` in the same change. Architectural changes include route/layout structure, server action boundaries, auth/authorization flow, Supabase schema/RLS/RPC behavior, cross-cutting integrations, env/config requirements, notification/email/push flow, cron/calendar behavior, or major folder ownership.

## Coding Guidance

- Start with the existing architecture and local patterns. Prefer small, targeted edits over new abstractions unless the current code clearly needs one.
- Keep server-only work in `src/server` or server actions/route handlers. Do not expose service-role keys, private VAPID keys, Resend credentials, or admin-only Supabase clients to client components.
- Treat `src/app/actions.ts` as the main mutation boundary. Validate inputs with Zod, enforce auth and rate limits where relevant, re-check booking conflicts server-side, create notifications through `src/server/notifications.ts`, and revalidate affected pages/layouts.
- Keep pure business logic in `src/domain` when possible. Scheduling, pricing, analytics, and chart-scale changes should be easy to test without rendering the app.
- Use `src/server/dashboard-data.ts` for Supabase reads and row-to-domain mapping instead of duplicating mapping logic in pages or components.
- Keep user-facing text localized through `src/i18n/dictionaries.ts` and `getDict()`/`useT()` unless the surrounding code already has a deliberate exception.
- For database changes, add an ordered migration in `supabase/migrations`, preserve RLS assumptions, and update `src/lib/database.types.ts`.
- For UI changes, follow the existing component system in `src/components/shared`, `src/components/admin`, and `src/components/client`; keep layouts responsive and avoid broad visual rewrites unless requested.
- Before finishing, run verification that matches the risk of the change and state exactly what was or was not run.

## Testing And TDD Guidance

Do not default to test-driven development for every change.

Use TDD or test-first work when the change affects business logic, booking/scheduling rules, auth or authorization, Supabase schema/RLS/RPC behavior, server actions, API routes, email/notification/push delivery, cron jobs, calendar exports/feeds, analytics calculations, or other critical code paths.

For small visual, color, spacing, copy, content, or documentation changes, make the focused edit directly and use appropriate lightweight verification instead. Do not add brittle tests just to prove a color or copy change unless the existing test suite already protects that contract intentionally.

When tests are appropriate, prefer focused coverage around the changed behavior first, then broader `pnpm test`, `pnpm lint`, and `pnpm build` as the risk and blast radius justify.

## UI Kit

- Primitives are shadcn v4 components in `src/components/ui` (do not hand-edit generated files casually; add new ones with `pnpm dlx shadcn@latest add <name>`). App wrappers with stable props live in `src/components/shared`; prefer those in feature code.
- Icons: hugeicons only, through `Icon` in `src/components/shared/icon.tsx` (`import { Calendar03Icon } from "@hugeicons/core-free-icons"`). Do not import `lucide-react` and do not write inline `<svg>` icons.
- Style with the semantic tokens (`bg-card`, `text-muted-foreground`, `bg-primary`, `text-destructive`, `ring-foreground/10`…) rather than hard-coded `stone-*`/black/white pairs; keep emerald/amber/sky/red accents only where they carry meaning.
- Phones first: 40px controls (44px for primary actions), full-width buttons below `sm`, shared `Modal` for dialogs (drawer on phones), content must clear the bottom tab bar (the shell pads for it).

## Navigation / Realtime Channels

The shell renders a desktop sidebar (`md+`) and a phone top bar + bottom tab bar (`<md`); both stay mounted, so hooks placed inside navigation components run twice.

`useAttentionRefresh` is therefore mounted once by `src/components/layout/attention-refresh.tsx` from `AppShell` (admin only). Keep it there, and keep its per-mount stable channel name (derived from `useId`) instead of `supabase.channel("admin-attention")`; a static channel name previously crashed the mobile drawer into the route error page.
