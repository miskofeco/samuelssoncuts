import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schedule = readFileSync("src/domain/schedule.ts", "utf8");
const actions = readFileSync("src/app/actions.ts", "utf8");
const slotPicker = readFileSync("src/components/client/slot-picker.tsx", "utf8");
const requestForm = readFileSync("src/components/client/request-form.tsx", "utf8");
const addBookingModal = readFileSync("src/components/admin/add-booking-modal.tsx", "utf8");
const bookingPricing = readFileSync("src/server/booking-pricing.ts", "utf8");

test("domain exposes a single client booking window of today through 14 days ahead", () => {
  assert.match(schedule, /export const CLIENT_BOOKING_WINDOW_DAYS = 14/);
  assert.match(schedule, /export function latestClientBookingDate/);
  assert.match(schedule, /export function isDateInClientBookingWindow/);
  assert.match(schedule, /export function isStartInClientBookingWindow/);
  assert.match(schedule, /export function isStartInFuture/);
  assert.match(schedule, /dateInShopTimeZone\(new Date\(\)\.toISOString\(\)\)/);
  assert.match(slotPicker, /zonedDateTimeToUtcIso/);
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
  const scheduleCalendar = readFileSync("src/components/shared/schedule-calendar.tsx", "utf8");

  assert.match(slotPicker, /latestClientBookingDate\(\)/);
  // Month navigation is bounded to the booking window; days outside it are
  // real `disabled` buttons rendered by the shared shadcn-based calendar.
  assert.match(slotPicker, /startMonth=\{monthKey\(today\)\}/);
  assert.match(slotPicker, /endMonth=\{monthKey\(latestDate\)\}/);
  assert.match(slotPicker, /disabled=\{\(day\) => !isBookable\(localDateToIso\(day\)\)\}/);
  assert.match(slotPicker, /isDateInClientBookingWindow\(iso\)/);
  assert.match(scheduleCalendar, /disabled:cursor-not-allowed/);
  assert.match(scheduleCalendar, /disabled:border-dashed/);
  assert.match(scheduleCalendar, /disabled:bg-muted\/60/);
  assert.doesNotMatch(slotPicker, /line-through/);
  assert.doesNotMatch(scheduleCalendar, /line-through/);
});

test("client booking can select today's shop date and filters only past times", () => {
  assert.match(slotPicker, /if \(!date \|\| !isDateInClientBookingWindow\(date\)\) return \[\]/);
  assert.doesNotMatch(slotPicker, /if \(!date \|\| date < today \|\| date > latestDate\) return \[\]/);
  assert.match(slotPicker, /zonedDateTimeToUtcIso\(date, s\.time\)/);
  assert.match(slotPicker, /isStartInFuture\(start\)/);
});

test("client calendar selected date uses the primary token while today keeps an inset ring", () => {
  const scheduleCalendar = readFileSync("src/components/shared/schedule-calendar.tsx", "utf8");

  assert.match(scheduleCalendar, /modifiers\.today && "ring-2 ring-inset ring-foreground"/);
  assert.match(scheduleCalendar, /modifiers\.selected &&\s*"border-primary bg-primary text-primary-foreground/);
  assert.match(slotPicker, /selected=\{date\}/);
  assert.match(slotPicker, /onSelect=\{onDateChange\}/);
  assert.doesNotMatch(slotPicker, /!border-emerald-500/);
});

test("client booking slots are hourly by default and adjusted around booked events", () => {
  assert.match(schedule, /export function clientSlotsForService/);
  assert.match(schedule, /for \(let start = opens; start \+ durationMin <= closes; start \+= 60\)/);
  assert.match(schedule, /starts\.add\(bookingStart - durationMin\)/);
  assert.match(schedule, /starts\.add\(bookingEnd\)/);
  assert.match(schedule, /isSlotFree\(date, start, durationMin, confirmed\)/);
  assert.match(slotPicker, /clientSlotsForService\(date, service\.duration, confirmed, businessHours\)/);
  assert.doesNotMatch(slotPicker, /slotsForService\(service\.duration\)/);
});

test("client booking slots respect configured closed weekdays and opening hours", () => {
  assert.match(schedule, /type SlotBusinessHoursDay/);
  assert.match(schedule, /export function businessHoursForDate/);
  assert.match(schedule, /export function isDateClosedForBusinessHours/);
  assert.match(schedule, /clientSlotsForService\(\s*date: string,\s*durationMin: number,\s*confirmed: SlotAppt\[],\s*businessHours\?: SlotBusinessHoursDay\[]/);
  assert.match(schedule, /const dayHours = businessHoursForDate\(date, businessHours\)/);
  assert.match(schedule, /if \(dayHours\?\.closed\) return \[\]/);
  assert.match(schedule, /start >= opens/);
  assert.match(schedule, /start \+ durationMin <= closes/);
});

test("client booking calendar disables configured closed weekdays", () => {
  assert.match(slotPicker, /businessHours/);
  assert.match(slotPicker, /isDateClosedForBusinessHours\(iso, businessHours\)/);
  assert.match(slotPicker, /isClosedInWindow/);
  assert.match(requestForm, /businessHours: BusinessHoursDay\[]/);
  assert.match(requestForm, /businessHours=\{businessHours\}/);
});

test("server rejects client booking requests outside generated client slots", () => {
  assert.match(actions, /quoteClientSlot/);
  assert.match(bookingPricing, /clientSlotsForService/);
  assert.match(
    bookingPricing,
    /!generated\.includes\(input\.time\)/,
  );
  assert.match(actions, /t\.feedback\.pickGeneratedSlot/);
});

test("best-price client slots use green borders", () => {
  assert.match(schedule, /export function isPreferredClientStart/);
  assert.match(schedule, /startMin \+ durationMin === bookingStart/);
  assert.match(schedule, /startMin === bookingEnd/);
  assert.match(slotPicker, /slot\.preferred/);
  assert.match(slotPicker, /isPreferredClientStart\(date, startMin, service\.duration, confirmed, businessHours\)/);
  assert.match(bookingPricing, /isPreferredClientStart/);
  assert.match(slotPicker, /border-emerald-500/);
  assert.match(slotPicker, /bg-emerald-50/);
});

test("first client booking of the day uses configured opening time as best price", () => {
  assert.match(
    schedule,
    /isPreferredClientStart\(\s*date: string,\s*startMin: number,\s*durationMin: number,\s*confirmed: SlotAppt\[],\s*businessHours\?: SlotBusinessHoursDay\[]/,
  );
  assert.match(schedule, /const dayHours = businessHoursForDate\(date, businessHours\)/);
  assert.match(schedule, /const openingMin = dayHours \? minutesOf\(dayHours\.opensAt\) : OPEN_MINUTES/);
  assert.match(schedule, /if \(dayBookings\.length === 0\) return startMin === openingMin/);
});

test("admin add booking date input cannot submit past starts from the UI", () => {
  assert.match(addBookingModal, /todayIso\(\)/);
  assert.match(addBookingModal, /min=\{today\}/);
  assert.match(addBookingModal, /adminSlotOptions\(\{/);
  assert.match(schedule, /nowMinutesInShopTimeZone\(now\)/);
});
