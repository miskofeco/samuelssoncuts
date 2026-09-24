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

test("confirmed reservations use the actual appointment before stale proposal history", () => {
  assert.match(reservationList, /confirmedRequestSlots\.find\(\(item\) => item\.requestId === request\.id\)/);
  assert.match(reservationList, /bookedSlotForRequest\(request, proposal, confirmedSlot\)/);
  assert.match(reservationList, /request\.status === "confirmed" && bookedSlot/);
});
