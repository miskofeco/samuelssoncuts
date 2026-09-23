import { Card, SectionHeader } from "@/components/shared/card";
import { formatFullDay, serviceById, surchargeDetailsForRequest } from "@/domain/schedule";
import type {
  PricingSettings,
  Appointment,
  BookingRequest,
  ClientProfile,
  Service,
} from "@/domain/types";
import { localeFor } from "@/i18n/config";
import { getDict, getLang } from "@/i18n/server";
import { shopDateTimeToEpochMs } from "@/lib/time-zone";

import {
  AdminBookingCarousel,
  type AdminBookingCarouselItem,
  type BookedSlotInput,
} from "./admin-booking-carousel";
import type { CalendarItem } from "./admin-calendar";

type BookingCard = {
  appointment: Appointment;
  clientName: string;
  clientAvatarUrl?: string | null;
  serviceName: string;
  durationMinutes: number;
  priceCents: number;
  startsAt: Date;
  endsAt: Date;
  surcharge?: boolean;
  surchargePercent?: number;
  calendarItem: CalendarItem;
};

function dateTimeOf(appointment: Appointment) {
  return new Date(shopDateTimeToEpochMs(appointment.date, appointment.time));
}

function buildBookingCards({
  appointments,
  requests,
  clients,
  services,
  clientFallback,
  gapSurchargePercent,
  vipSurchargePercent,
}: {
  appointments: Appointment[];
  requests: BookingRequest[];
  clients: ClientProfile[];
  services: Service[];
  clientFallback: string;
  gapSurchargePercent: number;
  vipSurchargePercent: number;
}) {
  const requestsById = new Map(requests.map((request) => [request.id, request]));
  const clientsById = new Map(clients.map((client) => [client.id, client]));

  return appointments
    .map((appointment): BookingCard => {
      const service = serviceById(appointment.serviceId, services);
      const client = appointment.clientId ? clientsById.get(appointment.clientId) : undefined;
      const request = appointment.requestId ? requestsById.get(appointment.requestId) : undefined;
      const surcharge = request
        ? surchargeDetailsForRequest(request, { gapSurchargePercent, vipSurchargePercent })
        : null;
      const startsAt = dateTimeOf(appointment);
      const endsAt = new Date(startsAt.getTime() + service.duration * 60_000);
      const servicePriceCents = Math.round(service.price * 100);
      const bookedPriceCents = appointment.requestId
        ? requestsById.get(appointment.requestId)?.priceCents ?? servicePriceCents
        : servicePriceCents;

      return {
        appointment,
        clientName: client?.name ?? appointment.clientName ?? clientFallback,
        clientAvatarUrl: client?.avatarUrl,
        serviceName: service.name,
        durationMinutes: service.duration,
        priceCents: bookedPriceCents,
        startsAt,
        endsAt,
        surcharge: request?.surcharge,
        surchargePercent: surcharge?.percent,
        calendarItem: {
          id: appointment.id,
          title: client?.name ?? appointment.clientName ?? clientFallback,
          service: service.name,
          servicePrice: service.price,
          finalPriceCents: bookedPriceCents,
          surcharge: request?.surcharge,
          surchargeKind: surcharge?.kind,
          surchargePercent: surcharge?.percent,
          time: appointment.time,
          date: appointment.date,
          durationMinutes: service.duration,
          type: appointment.requestId ? "Confirmed" : "Barber",
          appointmentId: appointment.id,
          requestId: appointment.requestId,
          clientId: appointment.clientId,
          clientEmail: client?.email,
          clientPhone: client?.phone,
          clientAvatarUrl: client?.avatarUrl,
          outcome: appointment.outcome,
        },
      };
    })
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

function selectBookingCards(bookings: BookingCard[], now: Date) {
  const nowMs = now.getTime();
  const currentBooking =
    bookings.find(
      (booking) => booking.startsAt.getTime() <= nowMs && booking.endsAt.getTime() > nowMs,
    ) ?? null;
  const lastBooking =
    [...bookings]
      .reverse()
      .find((booking) => booking.endsAt.getTime() <= nowMs && booking !== currentBooking) ?? null;
  const nextBooking =
    bookings.find((booking) => booking.startsAt.getTime() > nowMs && booking !== currentBooking) ??
    null;

  return { currentBooking, lastBooking, nextBooking };
}

export async function AdminBookingStrip({
  clients,
  requests,
  appointments,
  services,
  pricingSettings,
}: {
  clients: ClientProfile[];
  requests: BookingRequest[];
  appointments: Appointment[];
  services: Service[];
  pricingSettings: PricingSettings;
}) {
  const [t, lang] = await Promise.all([getDict(), getLang()]);
  const locale = localeFor(lang);
  const { currentBooking, lastBooking, nextBooking } = selectBookingCards(
    buildBookingCards({
      appointments,
      requests,
      clients,
      services,
      clientFallback: t.admin.clientFallback,
      gapSurchargePercent: pricingSettings.gapSurchargePercent,
      vipSurchargePercent: pricingSettings.vipSurchargePercent,
    }),
    new Date(),
  );
  function formatBooking(booking: BookingCard | null): AdminBookingCarouselItem["booking"] {
    return booking
      ? {
          clientName: booking.clientName,
          clientAvatarUrl: booking.clientAvatarUrl,
          serviceName: booking.serviceName,
          day: formatFullDay(booking.appointment.date, locale),
          time: booking.appointment.time,
          durationMinutes: booking.durationMinutes,
          priceCents: booking.priceCents,
          surcharge: booking.surcharge,
          surchargePercent: booking.surchargePercent,
          calendarItem: booking.calendarItem,
        }
      : null;
  }

  const bookingStripItems: AdminBookingCarouselItem[] = [
    {
      key: "last",
      title: t.admin.lastBooking,
      empty: t.admin.noLastBooking,
      booking: formatBooking(lastBooking),
      tone: "past" as const,
    },
    {
      key: "current",
      title: t.admin.currentBooking,
      empty: t.admin.noCurrentBooking,
      booking: formatBooking(currentBooking),
      tone: "current" as const,
    },
    {
      key: "next",
      title: t.admin.nextBooking,
      empty: t.admin.noNextBooking,
      booking: formatBooking(nextBooking),
      tone: "future" as const,
    },
  ];
  const bookedSlots: BookedSlotInput[] = appointments.map((appointment) => ({
    id: appointment.id,
    date: appointment.date,
    time: appointment.time,
    durationMinutes: serviceById(appointment.serviceId, services).duration,
  }));

  return (
    <Card>
      <SectionHeader title={t.admin.bookingSnapshot} />
      <AdminBookingCarousel
        items={bookingStripItems}
        bookedSlots={bookedSlots}
        positionLabel={t.admin.bookingSnapshotPosition}
      />
    </Card>
  );
}
