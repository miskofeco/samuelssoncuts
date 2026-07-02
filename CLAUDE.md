@AGENTS.md

## Mobile Sidebar / Realtime Channels

The desktop sidebar remains mounted on mobile and the mobile drawer mounts a second sidebar when opened. Sidebar-mounted hooks can run twice concurrently.

Never use a static Supabase realtime channel name from those hooks. Keep `useAttentionRefresh` on a per-mount stable channel name, not `supabase.channel("admin-attention")`, or the mobile drawer can crash into the route error page.
