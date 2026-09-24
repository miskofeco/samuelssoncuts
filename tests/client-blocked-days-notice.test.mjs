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
  assert.match(dashboardData, /blockedRanges: BlockedRange\[\]/);
  // Blocked days load concurrently with the other overview queries.
  assert.match(dashboardData, /supabase\.from\("services"\)\.select\("\*"\),\s*loadBlockedDays\(blockedWindow\),\s*\]\);/);
  assert.match(dashboardData, /blockedRanges: blocked\.ranges/);
  assert.match(clientPage, /blockedRanges=\{data\.blockedRanges\}/);
});

test("client overview renders a localized warning only for future blocked ranges", () => {
  assert.match(clientOverview, /blockedRanges,\s*\n\}/);
  assert.match(clientOverview, /blockedRanges: BlockedRange\[\]/);
  assert.match(clientOverview, /blockedRanges[\s\S]*\.filter\(\(range\) => range\.end >= today\)/);
  assert.match(clientOverview, /plannedBlocked\.length > 0/);
  assert.match(clientOverview, /t\.client\.blockedNoticeDescription/);
  assert.match(clientOverview, /formatBlockedRange\(range, locale\)/);
});

test("client blocked day notice copy is localized", () => {
  assert.match(dictionaries, /blockedNoticeEyebrow: "Planned unavailability"/);
  assert.match(dictionaries, /blockedNoticeTitle: "Barber unavailable at these times"/);
  assert.match(dictionaries, /blockedNoticeDescription:/);
  assert.match(dictionaries, /blockedNoticeEyebrow: "Plánovaná nedostupnosť"/);
  assert.match(dictionaries, /blockedNoticeTitle: "Barber nebude dostupný v týchto termínoch"/);
});
