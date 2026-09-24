import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminPage = readFileSync("src/app/admin/page.tsx", "utf8");

test("admin homepage renders the booking strip above overview stats", () => {
  assert.match(adminPage, /import \{ AdminBookingStrip \} from "@\/components\/admin\/admin-booking-strip"/);
  assert.match(
    adminPage,
    /<AdminBookingStrip[\s\S]*clients=\{data\.clients\}[\s\S]*requests=\{data\.requests\}[\s\S]*appointments=\{data\.appointments\}[\s\S]*services=\{data\.services\}[\s\S]*\/>[\s\S]*<AdminOverview/,
  );
});

test("admin booking strip shows current, last, and next booking cards with actual booked prices", () => {
  const strip = readFileSync("src/components/admin/admin-booking-strip.tsx", "utf8");
  const carousel = readFileSync("src/components/admin/admin-booking-carousel.tsx", "utf8");

  assert.match(strip, /currentBooking/);
  assert.match(strip, /lastBooking/);
  assert.match(strip, /nextBooking/);
  assert.match(strip, /const bookedPriceCents = appointment\.priceCents \?\? request\?\.priceCents \?\? servicePriceCents/);
  assert.match(carousel, /\{\(booking\.priceCents \/ 100\)\.toFixed\(2\)\} €/);
});

test("admin booking strip shows one snap card at a time with current booking centered by default", () => {
  const strip = readFileSync("src/components/admin/admin-booking-strip.tsx", "utf8");
  const carousel = readFileSync("src/components/admin/admin-booking-carousel.tsx", "utf8");

  assert.match(strip, /bookingStripItems: AdminBookingCarouselItem\[] = \[/);
  assert.match(strip, /key:\s*"last"/);
  assert.match(strip, /key:\s*"current"/);
  assert.match(strip, /key:\s*"next"/);
  assert.match(carousel, /use client/);
  assert.match(carousel, /initialIndex = 1/);
  assert.match(carousel, /scrollTo\(\{ left: el\.clientWidth \* initialIndex/);
  assert.match(carousel, /snap-x snap-mandatory overflow-x-auto/);
  assert.match(carousel, /scrollbar-none/);
  assert.match(carousel, /w-full shrink-0 snap-center/);
  assert.match(carousel, /aria-hidden=\{index !== activeIndex\}/);
  assert.doesNotMatch(carousel, /min-w-\[260px\]/);
});

test("admin booking strip renders pagination dots for last current and next positions", () => {
  const carousel = readFileSync("src/components/admin/admin-booking-carousel.tsx", "utf8");

  assert.match(carousel, /aria-label=\{positionLabel\}/);
  assert.match(carousel, /setActiveIndex\(Math\.round\(el\.scrollLeft \/ el\.clientWidth\)\)/);
  assert.match(carousel, /items\.map\(\(item, index\) => \(/);
  assert.match(carousel, /index === activeIndex/);
  assert.match(carousel, /h-2 w-2 rounded-full/);
});
