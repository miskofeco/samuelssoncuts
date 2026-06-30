import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schedule = readFileSync("src/domain/schedule.ts", "utf8");
const actions = readFileSync("src/app/actions.ts", "utf8");
const slotPicker = readFileSync("src/components/client/slot-picker.tsx", "utf8");
const addBookingModal = readFileSync("src/components/admin/add-booking-modal.tsx", "utf8");

test("domain exposes a single client booking window of today through 14 days ahead", () => {
  assert.match(schedule, /export const CLIENT_BOOKING_WINDOW_DAYS = 14/);
  assert.match(schedule, /export function latestClientBookingDate/);
  assert.match(schedule, /export function isDateInClientBookingWindow/);
  assert.match(schedule, /export function isStartInClientBookingWindow/);
  assert.match(schedule, /export function isStartInFuture/);
});

test("server actions reject client bookings outside the future two-week window", () => {
  assert.match(actions, /isStartInClientBookingWindow/);
  assert.match(actions, /t\.feedback\.chooseWithinTwoWeeks/);
  assert.match(actions, /createBookingRequestAction[\s\S]*!isStartInClientBookingWindow\(start\)/);
  assert.match(actions, /respondToProposalAction[\s\S]*!isStartInClientBookingWindow\(proposal\.starts_at\)/);
});

test("server actions reject past starts on admin booking-producing paths", () => {
  assert.match(actions, /isStartInFuture/);
  assert.match(actions, /proposeAppointmentAction[\s\S]*!isStartInFuture\(start\)/);
  assert.match(actions, /confirmRequestAction[\s\S]*!isStartInFuture\(request\.requested_start\)/);
  assert.match(actions, /rescheduleAppointmentAction[\s\S]*!isStartInFuture\(start\)/);
  assert.match(actions, /createAdminBookingAction[\s\S]*!isStartInFuture\(start\)/);
});

test("client calendar disables and visibly marks past and beyond-window dates", () => {
  assert.match(slotPicker, /latestClientBookingDate\(\)/);
  assert.match(slotPicker, /cell\.date > latestDate/);
  assert.match(slotPicker, /not-allowed/);
  assert.match(slotPicker, /!bg-stone-200/);
  assert.match(slotPicker, /border-dashed/);
  assert.doesNotMatch(slotPicker, /line-through/);
});

test("client calendar selected date is green while today keeps shared black ring", () => {
  const monthCalendar = readFileSync("src/components/shared/month-calendar.tsx", "utf8");

  assert.match(monthCalendar, /cell\.isToday && "ring-2 ring-black dark:ring-white"/);
  assert.match(slotPicker, /cell\.date === date/);
  assert.match(slotPicker, /!border-emerald-500/);
  assert.match(slotPicker, /ring-emerald-500/);
});

test("client booking slots are hourly by default and adjusted around booked events", () => {
  assert.match(schedule, /export function clientSlotsForService/);
  assert.match(schedule, /for \(let start = OPEN_MINUTES; start <= LAST_BOOK_MINUTES; start \+= 60\)/);
  assert.match(schedule, /starts\.add\(bookingStart - durationMin\)/);
  assert.match(schedule, /starts\.add\(bookingEnd\)/);
  assert.match(schedule, /isSlotFree\(date, start, durationMin, confirmed\)/);
  assert.match(slotPicker, /clientSlotsForService\(date, service\.duration, confirmed\)/);
  assert.doesNotMatch(slotPicker, /slotsForService\(service\.duration\)/);
});

test("server rejects client booking requests outside generated client slots", () => {
  assert.match(actions, /clientSlotsForService/);
  assert.match(actions, /!clientSlotsForService\(parsed\.data\.date, service\.duration_minutes, confirmedForDay\)\.includes\(parsed\.data\.time\)/);
  assert.match(actions, /t\.feedback\.pickGeneratedSlot/);
});

test("best-price client slots use green borders", () => {
  assert.match(schedule, /export function isPreferredClientStart/);
  assert.match(schedule, /startMin \+ durationMin === bookingStart/);
  assert.match(schedule, /startMin === bookingEnd/);
  assert.match(slotPicker, /slot\.preferred/);
  assert.match(slotPicker, /isPreferredClientStart\(date, startMin, service\.duration, confirmed\)/);
  assert.match(
    actions,
    /isPreferredClientStart\(\s*parsed\.data\.date,\s*startMin,\s*service\.duration_minutes,\s*confirmedForDay,\s*\)/,
  );
  assert.match(slotPicker, /border-emerald-500/);
  assert.match(slotPicker, /bg-emerald-50/);
});

test("admin add booking date input cannot submit past starts from the UI", () => {
  assert.match(addBookingModal, /todayIso\(\)/);
  assert.match(addBookingModal, /min=\{today\}/);
  assert.match(addBookingModal, /timeOptions\(duration, date \? bookedByDate\.get\(date\) \?\? \[\] : \[\], t, date\)/);
  assert.match(addBookingModal, /startMin <= nowMinutes/);
});
