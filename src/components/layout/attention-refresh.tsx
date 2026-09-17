"use client";

import { useAttentionRefresh } from "@/hooks/use-realtime-badge";

/**
 * Mounts the admin realtime "refresh server components" nudge exactly once per
 * shell. Kept out of the navigation components so a second navigation surface
 * (mobile tab bar, account sheet) never opens a duplicate channel.
 */
export function AttentionRefresh() {
  useAttentionRefresh();
  return null;
}
