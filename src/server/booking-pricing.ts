import {
  clientSlotsForService,
  isPreferredClientStart,
  minutesOf,
  priceCentsForSlot,
  priceKindForSlot,
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
  const { data, error } = await supabase.rpc("confirmed_appointment_slots_window", {
    p_from: startIso,
    p_to: endIso,
  });
  if (error) throw new Error(`confirmed_appointment_slots: ${error.message}`);

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

// Both client bookings and the suggested manual price use the same confirmed
// slots, shop hours, and barber pricing settings. Only client requests must
// belong to the generated client grid; admins can place 15-minute-grid slots.
async function quoteSlot(
  supabase: SupabaseClient,
  input: SlotQuoteInput,
  requireClientGrid: boolean,
): Promise<SlotQuote> {
  const [confirmedForDay, businessHours, pricingSettings] = await Promise.all([
    confirmedSlotsForDay(supabase, input.date, input.excludeStartsAt),
    loadBusinessHours(),
    loadPricingSettings(),
  ]);

  if (requireClientGrid) {
    const generated = clientSlotsForService(
      input.date,
      input.durationMinutes,
      confirmedForDay,
      businessHours,
    );
    if (!generated.includes(input.time)) {
      return { ok: false, reason: "not-generated-slot" };
    }
  }

  const preferred = isPreferredClientStart(
    input.date,
    minutesOf(input.time),
    input.durationMinutes,
    confirmedForDay,
    businessHours,
  );
  const priceCents = priceCentsForSlot(input.basePriceCents, preferred, {
    startsAt: input.time,
    ...pricingSettings,
  });

  return {
    ok: true,
    preferred,
    priceCents,
    surcharge: priceKindForSlot(preferred, { startsAt: input.time }) !== "base",
  };
}

/** Server-authoritative client price for new requests and reschedules. */
export async function quoteClientSlot(
  supabase: SupabaseClient,
  input: SlotQuoteInput,
): Promise<SlotQuote> {
  return quoteSlot(supabase, input, true);
}

/** Suggested manual-booking price for the admin grid, including off-client-grid starts. */
export async function quoteAdminSlot(
  supabase: SupabaseClient,
  input: SlotQuoteInput,
): Promise<SlotQuote> {
  return quoteSlot(supabase, input, false);
}
