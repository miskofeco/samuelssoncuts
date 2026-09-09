import {
  clientSlotsForService,
  isPreferredClientStart,
  minutesOf,
  priceForSlot,
  type SlotAppt,
} from "@/domain/schedule";
import type { createClient } from "@/lib/supabase/server";
import { shopDayRangeUtc, timeInShopTimeZone } from "@/lib/time-zone";
import { loadBusinessHours, loadPricingSettings } from "@/server/dashboard-data";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type SlotQuoteInput = {
  date: string;
  time: string;
  durationMinutes: number;
  /** Service list price in cents; the quote is derived from it server-side. */
  basePriceCents: number;
  /**
   * Confirmed appointment start (ISO) to leave out of the day's busy slots —
   * used when the client moves an existing appointment within the same day so
   * its own slot does not distort the gap pricing.
   */
  excludeStartsAt?: string;
};

export type SlotQuote =
  | { ok: true; preferred: boolean; priceCents: number; surcharge: boolean }
  | { ok: false; reason: "not-generated-slot" };

/** Confirmed bookings on `date` as slot-picker inputs (shop-local times). */
async function confirmedSlotsForDay(
  supabase: SupabaseClient,
  date: string,
  excludeStartsAt?: string,
): Promise<SlotAppt[]> {
  const { startIso, endIso } = shopDayRangeUtc(date);
  const { data } = await supabase.rpc("confirmed_appointment_slots");

  return (data ?? [])
    .filter((slot) => slot.starts_at >= startIso && slot.starts_at < endIso)
    .filter((slot) => !excludeStartsAt || slot.starts_at !== excludeStartsAt)
    .map((slot) => ({
      date,
      time: timeInShopTimeZone(slot.starts_at),
      durationMinutes: Math.round(
        (new Date(slot.ends_at).getTime() - new Date(slot.starts_at).getTime()) / 60000,
      ),
    }));
}

// Single source of truth for what a client pays for a slot. Both a fresh
// booking and a client-initiated reschedule must go through here, so the price
// is never trusted from the client and cannot be frozen across a move into a
// VIP or gap-surcharge slot. Also rejects times the slot picker would never
// offer (outside the generated grid for the day).
export async function quoteClientSlot(
  supabase: SupabaseClient,
  input: SlotQuoteInput,
): Promise<SlotQuote> {
  const confirmedForDay = await confirmedSlotsForDay(supabase, input.date, input.excludeStartsAt);
  const businessHours = await loadBusinessHours();

  const generated = clientSlotsForService(
    input.date,
    input.durationMinutes,
    confirmedForDay,
    businessHours,
  );
  if (!generated.includes(input.time)) {
    return { ok: false, reason: "not-generated-slot" };
  }

  const preferred = isPreferredClientStart(
    input.date,
    minutesOf(input.time),
    input.durationMinutes,
    confirmedForDay,
    businessHours,
  );
  const pricingSettings = await loadPricingSettings();
  const basePrice = Math.round(input.basePriceCents / 100);
  const priceCents = priceForSlot(basePrice, preferred, {
    startsAt: input.time,
    ...pricingSettings,
  }) * 100;

  return { ok: true, preferred, priceCents, surcharge: !preferred };
}
