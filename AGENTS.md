<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Mobile Sidebar / Realtime Channels

The desktop sidebar stays mounted even on mobile (`lg:hidden` only hides it visually). Opening the mobile drawer mounts a second `Sidebar` instance. Any hook used inside `Sidebar` can therefore run twice at the same time.

Do not use a static Supabase realtime channel name from sidebar-mounted hooks. In particular, `useAttentionRefresh` must keep using a per-mount stable channel name (currently derived from `useId`) instead of `supabase.channel("admin-attention")`. Reusing the static channel caused the mobile drawer to crash into the route error page when opened.
