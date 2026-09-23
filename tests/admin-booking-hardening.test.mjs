import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const schedule = readFileSync("src/domain/schedule.ts", "utf8");
const proposalForm = readFileSync("src/components/admin/proposal-form.tsx", "utf8");
const appointmentModal = readFileSync(
  "src/components/admin/appointment-detail-modal.tsx",
  "utf8",
);
const clientAppointmentPage = readFileSync(
  "src/app/client/reservations/[id]/page.tsx",
  "utf8",
);
const actions = readFileSync("src/app/actions.ts", "utf8");
const clientDetailPage = readFileSync("src/app/admin/clients/[clientId]/page.tsx", "utf8");

test("admin booking prices distinguish VIP and gap surcharges", () => {
  assert.match(schedule, /export function surchargeDetailsForRequest/);
  assert.match(schedule, /request\.requestedTime && isVipStart\(request\.requestedTime\)/);
  assert.match(proposalForm, /surchargeDetailsForRequest\(request, pricingSettings\)/);
  assert.match(proposalForm, /t\.admin\.vipSurcharge\(surcharge\.percent\)/);
  assert.match(proposalForm, /t\.admin\.gapSurcharge\(surcharge\.percent\)/);
  assert.match(appointmentModal, /t\.admin\.vipSurcharge\(item\.surchargePercent \?\? 0\)/);
  assert.match(clientAppointmentPage, /t\.client\.detailVipSurchargeNote\(appt\.surchargePercent \?\? 0\)/);
});

test("ended or completed appointments do not expose move or cancel actions", () => {
  assert.match(appointmentModal, /const canManage = !hasEnded && !item\.outcome/);
  assert.match(appointmentModal, /\{canManage \? \([\s\S]*t\.admin\.reschedule[\s\S]*t\.admin\.cancelAppointment/);
});

test("admin rescheduling refuses historical appointments at both action and database boundaries", () => {
  assert.match(actions, /select\("id, request_id, client_id, service_id, status, ends_at, outcome"\)/);
  assert.match(actions, /appointment\.outcome \|\| new Date\(appointment\.ends_at\)\.getTime\(\) <= Date\.now\(\)/);
  assert.match(actions, /t\.feedback\.appointmentAlreadyEnded/);

  const migrationPath = "supabase/migrations/0041_lock_historical_appointment_rescheduling.sql";
  assert.equal(existsSync(migrationPath), true);
  const migration = readFileSync(migrationPath, "utf8");
  assert.match(migration, /v_appt\.ends_at <= now\(\) or v_appt\.outcome is not null/);
});

test("client detail navigation uses the shared shadcn button wrapper", () => {
  assert.match(clientDetailPage, /import \{ ButtonLink \} from "@\/components\/shared\/button"/);
  assert.match(clientDetailPage, /<ButtonLink[\s\S]*variant="ghost"[\s\S]*t\.admin\.allClientsBack/);
  assert.doesNotMatch(clientDetailPage, /import Link from "next\/link"/);
});
