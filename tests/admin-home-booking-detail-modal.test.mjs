import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("booking snapshot cards open the shared appointment detail modal", () => {
  const carousel = readFileSync("src/components/admin/admin-booking-carousel.tsx", "utf8");

  assert.match(carousel, /import \{ AppointmentDetailModal \} from "\.\/appointment-detail-modal"/);
  assert.match(carousel, /const \[selected, setSelected\] = useState<CalendarItem \| null>\(null\)/);
  assert.match(carousel, /onSelect=\{setSelected\}/);
  assert.match(carousel, /onClick=\{\(\) => booking\?\.calendarItem \? onSelect\(booking\.calendarItem\) : undefined\}/);
  assert.match(carousel, /<AppointmentDetailModal[\s\S]*item=\{selected\}[\s\S]*bookedByDate=\{bookedByDate\}/);
});

test("admin upcoming appointments open the shared appointment detail modal", () => {
  const overview = readFileSync("src/components/admin/admin-overview.tsx", "utf8");
  const upcoming = readFileSync("src/components/admin/admin-upcoming-appointments.tsx", "utf8");

  assert.match(overview, /import \{ AdminUpcomingAppointments \} from "\.\/admin-upcoming-appointments"/);
  assert.match(overview, /<AdminUpcomingAppointments[\s\S]*items=\{upcomingItems\}[\s\S]*bookedSlots=\{bookedSlots\}/);
  assert.match(upcoming, /"use client"/);
  assert.match(upcoming, /import \{ AppointmentDetailModal \} from "\.\/appointment-detail-modal"/);
  assert.match(upcoming, /const \[selected, setSelected\] = useState<CalendarItem \| null>\(null\)/);
  assert.match(upcoming, /onClick=\{\(\) => setSelected\(item\.calendarItem\)\}/);
  assert.match(upcoming, /<AppointmentDetailModal[\s\S]*item=\{selected\}[\s\S]*bookedByDate=\{bookedByDate\}/);
});

test("admin upcoming appointments give client names readable space on mobile", () => {
  const upcoming = readFileSync("src/components/admin/admin-upcoming-appointments.tsx", "utf8");

  assert.match(upcoming, /flex w-full flex-col items-stretch/);
  assert.match(upcoming, /sm:flex-row sm:items-center sm:justify-between/);
  assert.match(upcoming, /break-words text-sm font-semibold/);
  assert.match(upcoming, /sm:truncate/);
  assert.match(upcoming, /mt-2 pl-11 text-left/);
  assert.match(upcoming, /sm:mt-0 sm:pl-0 sm:text-right/);
});
