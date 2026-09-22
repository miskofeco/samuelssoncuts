import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboardData = readFileSync("src/server/dashboard-data.ts", "utf8");
const clientDetail = readFileSync("src/components/admin/client-detail.tsx", "utf8");

test("admin client history loads only confirmed appointment records", () => {
  const loader = dashboardData.split("export async function loadClientHistory(")[1];
  assert.ok(loader, "client history loader exists");
  assert.match(
    loader,
    /\.from\("appointments"\)[\s\S]*?\.eq\("client_id", clientId\)\s*\.eq\("status", "confirmed"\)/,
  );
});

test("profile appointment totals and list use the filtered loader result", () => {
  assert.match(clientDetail, /detailTotalVisits\} value=\{appointments\.length\}/);
  assert.match(clientDetail, /\[\.\.\.appointments\][\s\S]*?\.map\(\(appointment\) =>/);
});
