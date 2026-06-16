import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const clientPage = readFileSync("src/app/client/page.tsx", "utf8");
const clientOverview = readFileSync(
  "src/components/client/client-overview.tsx",
  "utf8",
);
const dashboardData = readFileSync("src/server/dashboard-data.ts", "utf8");
const dictionaries = readFileSync("src/i18n/dictionaries.ts", "utf8");

test("client overview receives future barber blocked ranges from the overview loader", () => {
  assert.match(dashboardData, /blockedRanges: Array<\{ id: string; start: string; end: string; reason: string \| null \}>/);
  assert.match(dashboardData, /const blocked = await loadBlockedDays\(\)/);
  assert.match(dashboardData, /blockedRanges: blocked\.ranges/);
  assert.match(clientPage, /blockedRanges=\{data\.blockedRanges\}/);
});

test("client overview renders a localized warning only for future blocked ranges", () => {
  assert.match(clientOverview, /blockedRanges,\s*\n\}/);
  assert.match(clientOverview, /blockedRanges: Array<\{ id: string; start: string; end: string; reason: string \| null \}>/);
  assert.match(clientOverview, /blockedRanges[\s\S]*\.filter\(\(range\) => range\.end >= today\)/);
  assert.match(clientOverview, /plannedBlocked\.length > 0/);
  assert.match(clientOverview, /t\.client\.blockedNoticeDescription/);
  assert.match(clientOverview, /formatFullDay\(range\.start, locale\)/);
  assert.match(clientOverview, /formatFullDay\(range\.end, locale\)/);
});

test("client blocked day notice copy is localized", () => {
  assert.match(dictionaries, /blockedNoticeEyebrow: "Upcoming closures"/);
  assert.match(dictionaries, /blockedNoticeTitle: "Barber unavailable on these days"/);
  assert.match(dictionaries, /blockedNoticeDescription:/);
  assert.match(dictionaries, /blockedNoticeEyebrow: "Plánované zatvorenie"/);
  assert.match(dictionaries, /blockedNoticeTitle: "Barber nebude dostupný v týchto dňoch"/);
});
