import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schedule = readFileSync("src/domain/schedule.ts", "utf8");
const requestForm = readFileSync("src/components/client/request-form.tsx", "utf8");
const serviceManager = readFileSync("src/components/admin/service-manager.tsx", "utf8");
const actions = readFileSync("src/app/actions.ts", "utf8");
const dashboardData = readFileSync("src/server/dashboard-data.ts", "utf8");
const databaseTypes = readFileSync("src/lib/database.types.ts", "utf8");
const migration = readFileSync("supabase/migrations/0010b_service_images.sql", "utf8");

test("client booking uses service cards with public image defaults", () => {
  assert.match(schedule, /export function defaultServiceImage/);
  assert.match(schedule, /\/signature\.jpg/);
  assert.match(schedule, /\/beard-shape\.jpg/);
  assert.match(schedule, /\/beard-plus-cut\.jpg/);
  assert.match(schedule, /export function defaultClientServiceId/);
  assert.match(requestForm, /orderClientServices\(services\)/);
  assert.match(requestForm, /defaultClientServiceId\(services\)/);
  assert.match(requestForm, /title=\{t\.client\.chooseService\}/);
  // Compact radio-style chooser: 48px thumbnail, one-line description, price badge.
  assert.match(requestForm, /role="radiogroup"/);
  assert.match(requestForm, /aria-checked=\{selected\}/);
  assert.match(requestForm, /size-14 shrink-0 overflow-hidden rounded-lg/);
  assert.match(requestForm, /service\.description/);
  assert.match(requestForm, /line-clamp-2/);
  assert.match(requestForm, /<Badge variant=\{selected \? "default" : "secondary"\}/);
  assert.doesNotMatch(requestForm, /h-36/);
  assert.match(requestForm, /import Image from "next\/image"/);
  assert.match(requestForm, /const imageSrc = defaultServiceImage\(service\)/);
  assert.match(requestForm, /src=\{imageSrc\}/);
  assert.doesNotMatch(requestForm, /SelectField/);
});

test("client booking form keeps the header and service chooser outside the booking card", () => {
  // Only steps 2–4 (date, time, notes/summary) sit inside the framed card.
  assert.match(requestForm, /<form onSubmit=\{onSubmit\} className="space-y-5">/);
  assert.match(requestForm, /<StepHeader step=\{1\} eyebrow=\{t\.client\.newAppointment\} title=\{t\.client\.chooseService\} \/>/);
  assert.doesNotMatch(requestForm, /<Card className="-mx-4/);
  assert.match(requestForm, /aside=\{/);
  assert.match(requestForm, /\{t\.client\.summary\}/);
  // Phone CTA is sticky above the tab bar and hidden on desktop, where the
  // summary lives in the card's third column.
  assert.match(requestForm, /sticky bottom-\[calc\(var\(--spacing-bottom-nav\)\+env\(safe-area-inset-bottom\)\)\][^"]*lg:hidden/);
  assert.match(requestForm, /mt-auto hidden flex-col gap-3 border-t pt-4 lg:flex/);
});

test("services carry descriptions into client booking cards", () => {
  assert.match(schedule, /description: "Detailed haircut with consultation and styling\."/);
  assert.match(dashboardData, /description: row\.description/);
});

test("service image can be managed from admin settings and persisted", () => {
  assert.match(databaseTypes, /image_url: string \| null/);
  assert.match(migration, /add column if not exists image_url text/);
  assert.match(dashboardData, /imageUrl: row\.image_url/);
  assert.match(actions, /imageUrl: z\.string\(\)\.max\(500\)\.optional\(\)/);
  assert.match(actions, /image_url: parsed\.data\.imageUrl\?\.trim\(\) \|\| null/);
  assert.match(serviceManager, /imageUrl: service\.imageUrl \?\? ""/);
  assert.match(serviceManager, /label=\{t\.admin\.serviceImage\}/);
  assert.match(serviceManager, /import Image from "next\/image"/);
  assert.match(serviceManager, /defaultServiceImage\(service\)/);
  assert.match(serviceManager, /src=\{imageSrc\}/);
});
