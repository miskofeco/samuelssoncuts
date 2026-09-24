import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DEFAULT_BOOKING_CONTACT, bookingMapUrl } from "../src/domain/shop-contact.ts";

test("booking details default to the actual Vranov shop location", () => {
  assert.equal(DEFAULT_BOOKING_CONTACT.address, "Námestie Slobody 2675, 093 01 Vranov nad Topľou");
  assert.equal(DEFAULT_BOOKING_CONTACT.phone, "+421918531257");
  assert.match(bookingMapUrl(DEFAULT_BOOKING_CONTACT.address), /^https:\/\/www\.google\.com\/maps\//);
});

test("a changed address produces a map link for that address", () => {
  const url = new URL(bookingMapUrl("Hlavná 1, Košice"));
  assert.equal(url.searchParams.get("query"), "Hlavná 1, Košice");
});

test("contact settings are barber-owned and customer-readable", () => {
  const sql = readFileSync("supabase/migrations/0047_booking_contact_settings.sql", "utf8");
  const actions = readFileSync("src/app/actions.ts", "utf8");
  const detail = readFileSync("src/app/client/reservations/[id]/page.tsx", "utf8");
  const calendar = readFileSync("src/emails/calendar-links.ts", "utf8");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /grant select on public\.booking_contact_settings to authenticated/);
  assert.match(sql, /to authenticated[\s\S]*using \(true\)/);
  assert.match(sql, /booking contact barber update[\s\S]*public\.is_admin\(\)/);
  assert.match(sql, /with check[\s\S]*auth\.uid\(\)/);
  assert.match(actions, /saveBookingContactAction[\s\S]*requireAdmin\(\)[\s\S]*parsePhone/);
  assert.match(detail, /loadBookingContactSettings\(\)/);
  assert.match(detail, /location: address/);
  assert.match(calendar, /params\.set\("location", location\)/);
});

test("calendar subscription offers Google and a solid Apple button", () => {
  const exportModal = readFileSync("src/components/shared/calendar-export.tsx", "utf8");
  assert.match(exportModal, /https:\/\/calendar\.google\.com\/calendar\/render\?cid=\$\{encodeURIComponent\(webcalUrl\)\}/);
  assert.match(exportModal, /src="\/email-icons\/google\.png"/);
  assert.match(exportModal, /<Icon icon=\{AppleIcon\} className="size-\[18px\] \[&_path\]:fill-current" \/>/);
  assert.match(exportModal, /border-black bg-black text-white/);
});
