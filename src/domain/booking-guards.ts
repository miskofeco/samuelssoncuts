export type BusinessHoursWindow = {
  closed: boolean;
  opensAt: string;
  closesAt: string;
};

export type TimeRangeRow = {
  starts_at: string;
  ends_at: string;
};

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
