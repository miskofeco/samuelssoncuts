import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const reservationList = readFileSync("src/components/client/reservation-list.tsx", "utf8");

test("exact-slot awaiting confirmation panel only renders for pending requests", () => {
  assert.match(
    reservationList,
    /const pendingExactSlot =\s*request\.status === "pending" && Boolean\(request\.requestedDate && request\.requestedTime\)/,
  );
  assert.match(reservationList, /\{pendingExactSlot \?/);
});

test("confirmed exact-slot reservations show booked summary instead of awaiting label", () => {
  assert.match(
    reservationList,
    /const confirmedExactSlot =\s*request\.status === "confirmed" && Boolean\(request\.requestedDate && request\.requestedTime\)/,
  );
  assert.match(reservationList, /request\.status === "confirmed" && \(proposal \|\| confirmedExactSlot\)/);
  assert.match(reservationList, /proposal \? proposal\.date : request\.requestedDate as string/);
  assert.match(reservationList, /proposal \? proposal\.time : request\.requestedTime as string/);
});
