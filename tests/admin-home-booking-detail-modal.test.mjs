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

  assert.match(upcoming, /grid w-full grid-cols-\[minmax\(0,1fr\)_10rem\]/);
  assert.match(upcoming, /sm:grid-cols-\[minmax\(0,1fr\)_minmax\(8rem,0\.45fr\)_10rem\]/);
  assert.match(upcoming, /break-words text-sm font-semibold/);
  assert.match(upcoming, /sm:truncate/);
  assert.match(upcoming, /truncate text-xs text-stone-500 sm:hidden/);
  assert.match(upcoming, /text-right text-sm font-medium tabular-nums/);
});

test("admin overview stats use four compact cards in one desktop row", () => {
  const overview = readFileSync("src/components/admin/admin-overview.tsx", "utf8");
  const statCards = overview.match(/<StatCard/g) ?? [];

  assert.equal(statCards.length, 4);
  assert.match(overview, /grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4/);
  assert.doesNotMatch(overview, /<StatCard\s+label=\{t\.admin\.todayRevenue\}/);
  assert.doesNotMatch(overview, /<StatCard\s+label=\{t\.admin\.pendingApprovals\}/);
  assert.match(overview, /label=\{t\.admin\.todayAppointments\}/);
  assert.match(overview, /label=\{t\.admin\.revenueThisMonth\}/);
  assert.match(overview, /label=\{t\.admin\.openRequests\}/);
  assert.match(overview, /label=\{t\.admin\.awaitingClient\}/);
});
