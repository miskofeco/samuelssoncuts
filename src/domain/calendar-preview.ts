/** A read-only four-hour viewport around a booking request, within the admin calendar day. */
export function calendarPreviewWindow(time: string, durationMinutes: number) {
  const selectedStart = timeToMinutes(time);
  const span = 240;
  const opening = 7 * 60;
  const closing = 21 * 60;
  const centered = Math.floor((selectedStart - (span - durationMinutes) / 2) / 60) * 60;
  const start = Math.max(opening, Math.min(centered, closing - span));
  return { start, end: start + span };
}

export function calendarPreviewPlacement(
  time: string,
  durationMinutes: number,
  window: { start: number; end: number },
) {
  const start = timeToMinutes(time);
  const visibleStart = Math.max(start, window.start);
  const visibleEnd = Math.min(start + durationMinutes, window.end);
  if (visibleEnd <= visibleStart) return null;
  const span = window.end - window.start;
  return {
    top: ((visibleStart - window.start) / span) * 100,
    height: ((visibleEnd - visibleStart) / span) * 100,
  };
}

/** Pick the closest available alternate slot, preferring a later slot on ties. */
export function nearestAlternativeTime(
  options: readonly string[],
  requestedTime: string,
  unavailable: (time: string) => boolean,
) {
  const requestedMinutes = timeToMinutes(requestedTime);
  return options
    .filter((time) => time !== requestedTime && !unavailable(time))
    .sort((left, right) => {
      const leftMinutes = timeToMinutes(left);
      const rightMinutes = timeToMinutes(right);
      return Math.abs(leftMinutes - requestedMinutes) - Math.abs(rightMinutes - requestedMinutes)
        || rightMinutes - leftMinutes;
    })[0] ?? requestedTime;
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}
