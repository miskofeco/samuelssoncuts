import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminCalendar = readFileSync("src/components/admin/admin-calendar.tsx", "utf8");
const availabilityManager = readFileSync(
  "src/components/admin/availability-manager.tsx",
  "utf8",
);
const scheduleCalendar = readFileSync("src/components/shared/schedule-calendar.tsx", "utf8");
const slotPicker = readFileSync("src/components/client/slot-picker.tsx", "utf8");

test("all month calendars are built on the shadcn Calendar (react-day-picker)", () => {
  assert.match(scheduleCalendar, /from "@\/components\/ui\/calendar"/);
  assert.match(scheduleCalendar, /weekStartsOn=\{1\}/);
  assert.match(scheduleCalendar, /DayButton: \(props\) => \(/);
  assert.match(adminCalendar, /<ScheduleCalendar/);
  assert.match(slotPicker, /<ScheduleCalendar/);
  assert.match(availabilityManager, /<ScheduleCalendar/);
  assert.doesNotMatch(adminCalendar, /MonthCalendar/);
  assert.doesNotMatch(slotPicker, /MonthCalendar/);
  assert.doesNotMatch(availabilityManager, /MonthCalendar/);
});

test("admin month view uses the fluid calendar without its own navigation", () => {
  assert.match(adminCalendar, /size="fluid"/);
  assert.match(adminCalendar, /hideNavigation/);
  assert.match(adminCalendar, /month=\{selectedMonth\}/);
});

test("admin toolbar navigates every view and offers a jump-to-date calendar popover", () => {
  assert.match(adminCalendar, /navigateCalendar\("month", `\$\{shiftMonth\(selectedMonth, direction\)\}-01`\)/);
  assert.match(adminCalendar, /function jumpToDate\(iso: string\)/);
  assert.match(adminCalendar, /<Popover open=\{jumpOpen\} onOpenChange=\{setJumpOpen\}>/);
  assert.match(adminCalendar, /<Calendar\s+mode="single"/);
  assert.match(adminCalendar, /aria-label=\{t\.admin\.jumpToDate\}/);
  assert.match(adminCalendar, /prev: t\.common\.previousMonth, next: t\.common\.nextMonth/);
});

test("admin month calendar renders event dots without visible event labels", () => {
  assert.match(adminCalendar, /flex flex-row flex-wrap gap-1/);
  assert.match(adminCalendar, /block h-2 w-2 rounded-full/);
  assert.match(adminCalendar, /monthDotToneClasses\(item\.type\)/);
  assert.match(adminCalendar, /<span className="sr-only">/);
  assert.doesNotMatch(adminCalendar, /sr-only sm:not-sr-only">\s*\{item\.time\}/);
  assert.doesNotMatch(adminCalendar, /items\.length > 2/);
});

test("availability manager uses a range calendar for whole days and a single calendar for time slices", () => {
  assert.match(availabilityManager, /sliceMode \? \(\s*<ScheduleCalendar/);
  assert.match(availabilityManager, /<Calendar\s+mode="range"/);
  assert.match(availabilityManager, /numberOfMonths=\{isMobile \? 1 : 2\}/);
  assert.match(availabilityManager, /setEnd\(range\.to \? localDateToIso\(range\.to\) : from\)/);
  assert.match(availabilityManager, /disabled=\{\{ before: isoToLocalDate\(today\)! \}\}/);
});

test("blocked days are painted red and announced in every calendar", () => {
  assert.match(adminCalendar, /blocked: \(day\) => blockedDates\.has\(localDateToIso\(day\)\)/);
  assert.match(adminCalendar, /modifiers\.blocked &&\s*!modifiers\.past &&\s*"border-red-300 bg-red-50/);
  assert.match(adminCalendar, /\{t\.admin\.off\}/);
  assert.match(availabilityManager, /blocked: \(day\) => blockedDates\.has\(localDateToIso\(day\)\)/);
  assert.match(availabilityManager, /border-red-300 bg-red-50/);
  assert.match(availabilityManager, /<span className="sr-only">\{t\.admin\.off\}<\/span>/);
  assert.match(slotPicker, /closed: \(day\) => isClosedInWindow\(localDateToIso\(day\)\)/);
  assert.match(slotPicker, /disabled:border-red-300 disabled:bg-red-50/);
  assert.match(slotPicker, /<span className="sr-only">\{t\.client\.unavailable\}<\/span>/);
});

test("client booking only marks closed days inside the booking window", () => {
  assert.match(slotPicker, /const isClosedInWindow = \(iso: string\) =>\s*isDateInClientBookingWindow\(iso\) &&/);
  assert.match(slotPicker, /blockedDates\.has\(iso\) \|\| isDateClosedForBusinessHours\(iso, businessHours\)/);
});

test("client booking picker follows the appointment-picker layout with an optional confirm column", () => {
  assert.match(slotPicker, /aside\?: ReactNode/);
  assert.match(slotPicker, /lg:grid-cols-\[minmax\(0,24rem\)_minmax\(0,1fr\)_minmax\(0,19rem\)\]/);
  assert.match(slotPicker, /min-h-48 flex-1 flex-col items-center justify-center/);
  assert.match(slotPicker, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1\.1fr\)\]/);
  assert.match(slotPicker, /lg:max-h-\[22rem\][^"]*lg:overflow-y-auto/);
  assert.match(slotPicker, /\{aside \? \(\s*<section className="flex flex-col border-t bg-muted\/30/);
});

test("past admin month cells use muted dashed styling without crossed numbers", () => {
  assert.match(adminCalendar, /past: \(day\) => localDateToIso\(day\) < today/);
  assert.match(adminCalendar, /modifiers\.past && !modifiers\.selected && "border-dashed bg-muted\/60 text-muted-foreground"/);
  assert.doesNotMatch(adminCalendar, /line-through/);
  assert.doesNotMatch(scheduleCalendar, /shadow-inner/);
});

test("calendar day state rings stay inside their cells", () => {
  assert.match(scheduleCalendar, /modifiers\.today && "ring-2 ring-inset ring-foreground"/);
  assert.match(scheduleCalendar, /focus-visible:ring-inset/);
  assert.doesNotMatch(scheduleCalendar, /ring-offset-2 ring-offset-background/);
});

test("availability management hides blocked periods that already ended", () => {
  assert.match(
    availabilityManager,
    /const visibleRanges = ranges\.filter\(\(range\) => range\.end >= today\)/,
  );
  assert.match(availabilityManager, /visibleRanges\.length/);
  assert.match(availabilityManager, /visibleRanges\.map\(\(range\) =>/);
});

test("admin calendar distinguishes confirmed, barber-added, and proposed colors", () => {
  assert.match(adminCalendar, /type: appointment\.requestId \? "Confirmed" : "Barber"/);
  assert.match(adminCalendar, /type: "Confirmed" \| "Barber" \| "Proposed"/);
  assert.match(adminCalendar, /function monthDotToneClasses\(type: CalendarItem\["type"\]\)/);
  assert.match(adminCalendar, /const neutralChipClasses/);
  assert.match(adminCalendar, /function accentToneClasses\(type: CalendarItem\["type"\]\)/);
  assert.match(adminCalendar, /case "Confirmed":[\s\S]*return "bg-emerald-500"/);
  assert.match(adminCalendar, /case "Barber":[\s\S]*return "bg-blue-500"/);
  assert.match(adminCalendar, /case "Proposed":[\s\S]*return "bg-orange-500"/);
});

test("week calendar marks blocked days red on desktop and mobile", () => {
  assert.match(adminCalendar, /blockedDates=\{blockedDates\}/);
  assert.match(adminCalendar, /isBlocked=\{blockedDates\.has\(day\)\}/);
  assert.match(adminCalendar, /isBlocked\s*\?\s*"bg-red-50/);
  assert.match(adminCalendar, /isBlocked\s*\?\s*t\.admin\.off\s*:\s*t\.admin\.noAppointments/);
});

test("blocked days do not allow adding bookings in week or month views", () => {
  assert.match(adminCalendar, /\{!isBlocked \? \(/);
  assert.match(adminCalendar, /\{!isBlocked \? \(/);
  assert.doesNotMatch(adminCalendar, /!isBlocked \? \(\s*isBlocked \? null/);
  assert.match(adminCalendar, /onClick=\{\(\) => onAddSlot\(day, firstFreeSlot\(items, isToday\)\)\}/);
  assert.match(adminCalendar, /onSelect=\{\(iso\) => \{/);
  assert.match(adminCalendar, /if \(items\.length === 0 && !blockedDates\.has\(iso\) && iso >= today\) \{/);
  assert.match(adminCalendar, /setDraft\(\{ date: iso \}\)/);
  assert.match(adminCalendar, /if \(modifiers\.blocked\) \{/);
});

test("week calendar pointer snapping uses rendered grid height", () => {
  assert.match(adminCalendar, /function snapPointerToMinutes\(clientY: number, rect: Pick<DOMRect, "top" \| "height">\)/);
  assert.match(adminCalendar, /const renderedHourHeight = rect\.height > 0 \? rect\.height \/ GRID_HOURS : HOUR_HEIGHT/);
  assert.match(adminCalendar, /snapOffsetToMinutes\(clientY - rect\.top, renderedHourHeight\)/);
  assert.match(adminCalendar, /snapPointerToMinutes\(event\.clientY, rect\)/);
});

test("week calendar day headers reserve the body scrollbar gutter", () => {
  assert.match(adminCalendar, /const WEEK_GRID_COLUMNS = "64px repeat\(7, minmax\(0, 1fr\)\)"/);
  assert.match(adminCalendar, /const \[scrollbarWidth, setScrollbarWidth\] = useState\(0\)/);
  assert.match(adminCalendar, /el\.offsetWidth - el\.clientWidth/);
  assert.match(adminCalendar, /paddingRight: scrollbarWidth/);
  assert.match(adminCalendar, /gridTemplateColumns: WEEK_GRID_COLUMNS/);
});
