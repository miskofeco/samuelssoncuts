import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminCalendar = readFileSync("src/components/admin/admin-calendar.tsx", "utf8");
const availabilityManager = readFileSync(
  "src/components/admin/availability-manager.tsx",
  "utf8",
);
const monthCalendar = readFileSync("src/components/shared/month-calendar.tsx", "utf8");
const slotPicker = readFileSync("src/components/client/slot-picker.tsx", "utf8");

test("admin month calendar renders event dots without visible event labels", () => {
  assert.match(adminCalendar, /flex flex-row flex-wrap gap-1/);
  assert.match(adminCalendar, /block h-2 w-2 rounded-full/);
  assert.match(adminCalendar, /monthDotToneClasses\(item\.type\)/);
  assert.match(adminCalendar, /<span className="sr-only">/);
  assert.doesNotMatch(adminCalendar, /sr-only sm:not-sr-only">\s*\{item\.time\}/);
  assert.doesNotMatch(adminCalendar, /items\.length > 2/);
});

test("availability month calendar hides blocked-day label text on mobile while keeping colored pills", () => {
  assert.match(availabilityManager, /h-2[^"]*sm:h-auto/);
  assert.match(availabilityManager, /sr-only sm:not-sr-only/);
});

test("month calendars can color the whole blocked day cell red", () => {
  assert.match(monthCalendar, /dayClassName\?: \(cell: MonthCell\) => string/);
  assert.match(adminCalendar, /dayClassName=\{\(cell\) =>/);
  assert.match(availabilityManager, /dayClassName=\{\(cell\) =>/);
  assert.match(adminCalendar, /bg-red-50[^"]*dark:bg-red-500\/15/);
  assert.match(availabilityManager, /bg-red-50[^"]*dark:bg-red-500\/15/);
});

test("adjacent month calendar cells remain clickable and renderable", () => {
  assert.doesNotMatch(monthCalendar, /cell\.inMonth && dayClassName/);
  assert.doesNotMatch(monthCalendar, /onDayClick && cell\.inMonth/);
  assert.doesNotMatch(monthCalendar, /cell\.inMonth && renderDay/);
  assert.doesNotMatch(slotPicker, /!cell\.inMonth/);
});

test("past month cells use disabled grey cell styling without crossed numbers", () => {
  assert.match(adminCalendar, /!bg-stone-200/);
  assert.match(slotPicker, /!bg-stone-200/);
  assert.doesNotMatch(adminCalendar, /shadow-inner/);
  assert.doesNotMatch(slotPicker, /shadow-inner/);
  assert.doesNotMatch(adminCalendar, /line-through/);
  assert.doesNotMatch(slotPicker, /line-through/);
});

test("past blocked dates use disabled stone styling before blocked red styling", () => {
  assert.match(slotPicker, /if \(outOfWindow\)[\s\S]*if \(blockedDates\.has\(cell\.date\)\)/);
  assert.match(adminCalendar, /cell\.date < today[\s\S]*blockedDates\.has\(cell\.date\)/);
  assert.match(availabilityManager, /cell\.date < today[\s\S]*blockedDates\.has\(cell\.date\)/);
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
  assert.match(adminCalendar, /isBlocked \? null : \(/);
  assert.match(adminCalendar, /onClick=\{\(\) => onAddSlot\(day, firstFreeSlot\(items, isToday\)\)\}/);
  assert.match(adminCalendar, /onDayClick=\{\(cell\) => \{/);
  assert.match(adminCalendar, /if \(items\.length === 0 && !blockedDates\.has\(cell\.date\) && cell\.date >= today\) \{/);
  assert.match(adminCalendar, /setDraft\(\{ date: cell\.date \}\)/);
  assert.match(adminCalendar, /if \(blocked\) \{/);
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
