"use client";

import Link from "next/link";
import { Card, SectionHeader } from "@/components/shared/card";
import { StatusPill } from "@/components/shared/status-pill";
import { formatFullDay, serviceById } from "@/domain/schedule";
import type {
  Appointment,
  BookingRequest,
  BusinessHoursDay,
  ClientAppointment,
  PricingSettings,
  Service,
} from "@/domain/types";
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";

import { ConfirmedAppointmentActions } from "./confirmed-appointment-actions";

// Client self-service over confirmed appointments (cancel + request-reschedule),
// gated on the 24h lead-time flag computed server-side (canModify).
export function UpcomingAppointments({
  appointments,
  services,
  pricingSettings,
  bookedSlots,
  pendingRequests,
  blockedDates,
  businessHours,
}: {
  appointments: ClientAppointment[];
  services: Service[];
  pricingSettings: PricingSettings;
  // Confirmed slots (from confirmed_appointment_slots) shaped for the picker.
  bookedSlots: Appointment[];
  pendingRequests: BookingRequest[];
  blockedDates: ReadonlySet<string>;
  businessHours: BusinessHoursDay[];
}) {
  const t = useT();
  if (appointments.length === 0) return null;

  return (
    <Card className="rounded-2xl p-5">
      <SectionHeader title={t.client.upcomingTitle} />
      <div className="mt-4 space-y-3">
        {appointments.map((appointment) => (
          <UpcomingCard
            key={appointment.id}
            appointment={appointment}
            services={services}
            pricingSettings={pricingSettings}
            bookedSlots={bookedSlots}
            pendingRequests={pendingRequests}
            blockedDates={blockedDates}
            businessHours={businessHours}
          />
        ))}
      </div>
    </Card>
  );
}

function UpcomingCard({
  appointment,
  services,
  pricingSettings,
  bookedSlots,
  pendingRequests,
  blockedDates,
  businessHours,
}: {
  appointment: ClientAppointment;
  services: Service[];
  pricingSettings: PricingSettings;
  bookedSlots: Appointment[];
  pendingRequests: BookingRequest[];
  blockedDates: ReadonlySet<string>;
  businessHours: BusinessHoursDay[];
}) {
  const t = useT();
  const locale = localeFor(useLang());
  const service = serviceById(appointment.serviceId, services);
  return (
    <article className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-black dark:text-white">{service.name}</h3>
          <p className="mt-0.5 text-sm font-medium text-emerald-900 dark:text-emerald-200">
            {formatFullDay(appointment.date, locale)} · {appointment.time}
          </p>
          <Link
            href={`/client/reservations/${appointment.id}`}
            className="mt-1 inline-block text-xs font-semibold text-emerald-800 underline underline-offset-4 dark:text-emerald-300"
          >
            {t.client.detailTitle}
          </Link>
        </div>
        <StatusPill tone="success">{t.client.upcomingConfirmed}</StatusPill>
      </div>

      <ConfirmedAppointmentActions
        appointment={appointment}
        service={service}
        services={services}
        pricingSettings={pricingSettings}
        bookedSlots={bookedSlots}
        pendingRequests={pendingRequests}
        blockedDates={blockedDates}
        businessHours={businessHours}
      />
    </article>
  );
}
