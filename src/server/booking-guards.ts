import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type BusinessHoursWindow = {
  closed: boolean;
  opensAt: string;
  closesAt: string;
};

export type TimeRangeRow = {
  starts_at: string;
  ends_at: string;
};

export const DEFAULT_BUSINESS_HOURS: BusinessHoursWindow = {
  closed: false,
  opensAt: "07:00",
  closesAt: "21:00",
};

function weekdayForDate(date: string) {
  return new Date(`${date}T12:00:00`).getDay();
}

function minutesFromClock(value: string) {
  const [hours = "0", minutes = "0"] = value.slice(0, 5).split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function isSlotInsideBusinessHours(
  window: BusinessHoursWindow,
  startTime: string,
  durationMinutes: number,
) {
  if (window.closed) return false;

  const opens = minutesFromClock(window.opensAt);
  const closes = minutesFromClock(window.closesAt);
  const start = minutesFromClock(startTime);
  const end = start + durationMinutes;

  return closes > opens && start >= opens && end <= closes;
}

export function slotOverlapsRange(startIso: string, endIso: string, range: TimeRangeRow) {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const rangeStartMs = new Date(range.starts_at).getTime();
  const rangeEndMs = new Date(range.ends_at).getTime();

  return startMs < rangeEndMs && rangeStartMs < endMs;
}

export async function loadBusinessHoursWindow(
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
  if (!row) return DEFAULT_BUSINESS_HOURS;

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
