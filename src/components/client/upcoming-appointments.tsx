"use client";

import { ArrowRight01Icon, CalendarCheckIn01Icon } from "@hugeicons/core-free-icons";

import { ButtonLink } from "@/components/shared/button";
import { Card, SectionHeader } from "@/components/shared/card";
import { Icon } from "@/components/shared/icon";
import { StatusPill } from "@/components/shared/status-pill";
import { formatFullDay, serviceById } from "@/domain/schedule";
import type {
  Appointment,
  BlockedInterval,
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
  blockedIntervals,
  businessHours,
}: {
  appointments: ClientAppointment[];
  services: Service[];
  pricingSettings: PricingSettings;
  // Confirmed slots (from confirmed_appointment_slots) shaped for the picker.
  bookedSlots: Appointment[];
  pendingRequests: BookingRequest[];
  blockedDates: ReadonlySet<string>;
  blockedIntervals: BlockedInterval[];
  businessHours: BusinessHoursDay[];
}) {
  const t = useT();
  if (appointments.length === 0) return null;

  return (
    <Card className="rounded-2xl">
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
            blockedIntervals={blockedIntervals}
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
  blockedIntervals,
  businessHours,
}: {
  appointment: ClientAppointment;
  services: Service[];
  pricingSettings: PricingSettings;
  bookedSlots: Appointment[];
  pendingRequests: BookingRequest[];
  blockedDates: ReadonlySet<string>;
  blockedIntervals: BlockedInterval[];
  businessHours: BusinessHoursDay[];
}) {
  const t = useT();
  const locale = localeFor(useLang());
  const service = serviceById(appointment.serviceId, services);
  return (
    <article className="rounded-xl bg-emerald-500/8 p-4 ring-1 ring-emerald-500/25 dark:bg-emerald-400/10">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
          <Icon icon={CalendarCheckIn01Icon} className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-semibold text-foreground">{service.name}</h3>
            <StatusPill tone="success" dot className="shrink-0">
              {t.client.upcomingConfirmed}
            </StatusPill>
          </div>
          <p className="mt-0.5 text-sm font-medium text-emerald-800 tabular-nums dark:text-emerald-200">
            {formatFullDay(appointment.date, locale)} · {appointment.time}
          </p>
          <ButtonLink
            href={`/client/reservations/${appointment.id}`}
            variant="link"
            size="sm"
            className="mt-1 h-8 px-0 text-emerald-800 dark:text-emerald-300"
          >
            {t.client.detailTitle}
            <Icon icon={ArrowRight01Icon} className="size-3.5" strokeWidth={2} />
          </ButtonLink>
        </div>
      </div>

      <ConfirmedAppointmentActions
        appointment={appointment}
        service={service}
        services={services}
        pricingSettings={pricingSettings}
        bookedSlots={bookedSlots}
        pendingRequests={pendingRequests}
        blockedDates={blockedDates}
        blockedIntervals={blockedIntervals}
        businessHours={businessHours}
      />
    </article>
  );
}
