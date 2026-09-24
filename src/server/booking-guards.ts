import type { createClient } from "@/lib/supabase/server";
import { isSlotInsideBusinessHours, type BusinessHoursWindow } from "@/domain/booking-guards";
import { getShopBarberId } from "@/server/shop-barber";

export { isSlotInsideBusinessHours, slotOverlapsRange } from "@/domain/booking-guards";
export type { BusinessHoursWindow, TimeRangeRow } from "@/domain/booking-guards";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function weekdayForDate(date: string) {
  return new Date(`${date}T12:00:00`).getDay();
}

function defaultBusinessHours(date: string): BusinessHoursWindow {
  return {
    closed: weekdayForDate(date) === 0,
    opensAt: "07:00",
    closesAt: "21:00",
  };
}


async function loadBusinessHoursWindow(
  supabase: SupabaseClient,
  date: string,
  barberId?: string,
): Promise<BusinessHoursWindow | null> {
  let query = supabase
    .from("business_hours")
    .select("opens_at, closes_at, closed")
    .eq("weekday", weekdayForDate(date));

  if (barberId) {
    query = query.eq("barber_id", barberId);
  }

  const { data, error } = await query.limit(1);

  if (error) return null;

  const row = data?.[0];
  if (!row) return defaultBusinessHours(date);

  return {
    closed: Boolean(row.closed),
    opensAt: row.opens_at.slice(0, 5),
    closesAt: row.closes_at.slice(0, 5),
  };
}

export async function isSlotInsideConfiguredBusinessHours(
  supabase: SupabaseClient,
  input: {
    date: string;
    time: string;
    durationMinutes: number;
    barberId?: string;
  },
) {
  const window = await loadBusinessHoursWindow(supabase, input.date, input.barberId);
  if (!window) return false;
  return isSlotInsideBusinessHours(window, input.time, input.durationMinutes);
}

export async function hasBlockedTimeOverlap(
  supabase: SupabaseClient,
  input: {
    start: string;
    end: string;
    barberId?: string;
  },
) {
  let query = supabase
    .from("blocked_times")
    .select("id")
    .lt("starts_at", input.end)
    .gt("ends_at", input.start)
    .limit(1);

  if (input.barberId) {
    query = query.eq("barber_id", input.barberId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) return true;
  return Boolean(data);
}

export async function hasConfirmedAppointmentOverlap(
  supabase: SupabaseClient,
  input: {
    start: string;
    end: string;
    barberId?: string;
    excludeAppointmentId?: string;
  },
) {
  const { data, error } = await supabase.rpc("has_confirmed_appointment_overlap", {
    p_barber_id: input.barberId ?? null,
    p_start: input.start,
    p_end: input.end,
    p_exclude_appointment_id: input.excludeAppointmentId ?? null,
  });

  if (error) return true;
  return data === true;
}

export type SlotGuardInput = {
  date: string;
  time: string;
  durationMinutes: number;
  start: string;
  end: string;
  barberId?: string;
  excludeAppointmentId?: string;
};

export type SlotGuardResult =
  | { ok: true }
  | { ok: false; reason: "outside-hours" | "blocked" | "conflict" };

/**
 * Shared server-side availability gate for every action that creates or moves
 * a booking. Keeping the three checks together prevents one mutation path from
 * accidentally omitting business hours, blocked time, or overlap protection.
 */
export async function guardSlot(
  supabase: SupabaseClient,
  input: SlotGuardInput,
): Promise<SlotGuardResult> {
  const barberId = input.barberId ?? await getShopBarberId();
  const [insideHours, blocked, conflict] = await Promise.all([
    isSlotInsideConfiguredBusinessHours(supabase, {
      barberId,
      date: input.date,
      time: input.time,
      durationMinutes: input.durationMinutes,
    }),
    hasBlockedTimeOverlap(supabase, {
      barberId,
      start: input.start,
      end: input.end,
    }),
    hasConfirmedAppointmentOverlap(supabase, {
      barberId,
      start: input.start,
      end: input.end,
      excludeAppointmentId: input.excludeAppointmentId,
    }),
  ]);
  if (!insideHours) {
    return { ok: false, reason: "outside-hours" };
  }
  if (blocked) {
    return { ok: false, reason: "blocked" };
  }
  if (conflict) {
    return { ok: false, reason: "conflict" };
  }

  return { ok: true };
}
