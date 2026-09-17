@AGENTS.md

## Navigation / Realtime Channels

Desktop sidebar and phone navigation both stay mounted. Never call `useAttentionRefresh` from navigation components; it is mounted once by `src/components/layout/attention-refresh.tsx` in `AppShell`.

Never use a static Supabase realtime channel name from that hook. Keep `useAttentionRefresh` on a per-mount stable channel name, not `supabase.channel("admin-attention")`.
