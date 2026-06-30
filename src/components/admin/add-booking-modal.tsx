"use client";

import { useMemo, useState, useTransition } from "react";

import { createAdminBookingAction } from "@/app/actions";
import type { BookedSlot } from "@/components/admin/admin-calendar";
import { Button } from "@/components/shared/button";
import { Combobox } from "@/components/shared/combobox";
import { Feedback } from "@/components/shared/feedback";
import { Field, SelectField } from "@/components/shared/form";
import { Modal } from "@/components/shared/modal";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { minutesOf, overlaps, slotsForService, todayIso } from "@/domain/schedule";
import type { ActionResult, ClientProfile, Service } from "@/domain/types";
import type { Dict } from "@/i18n/dictionaries";
import { useT } from "@/i18n/provider";

type CustomerMode = "client" | "walkin";

// Time-picker options for a service duration, with slots that overlap an existing
// booking on `date` marked disabled. `slotsForService` already drops starts whose
// end would run past closing, so the remaining list always fits the service.
function timeOptions(durationMinutes: number, bookedToday: BookedSlot[], t: Dict, date?: string) {
  const now = new Date();
  const today = todayIso();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slotsForService(durationMinutes).map((time) => {
    const startMin = minutesOf(time);
    const clash = bookedToday.some((slot) =>
      overlaps(startMin, durationMinutes, minutesOf(slot.time), slot.durationMinutes),
    );
    const past = Boolean(date && (date < today || (date === today && startMin <= nowMinutes)));
    return {
      value: time,
      label: time,
      disabled: clash || past,
      hint: past ? t.feedback.chooseFutureTime : clash ? t.admin.slotTakenHint : undefined,
    };
  });
}

export function AddBookingModal({
  open,
  onClose,
  clients,
  services,
  initialDate,
  initialTime,
  bookedByDate,
}: {
  open: boolean;
  onClose: () => void;
  clients: ClientProfile[];
  services: Service[];
  initialDate?: string;
  initialTime?: string;
  bookedByDate: Map<string, BookedSlot[]>;
}) {
  const t = useT();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.admin.addBookingTitle}
      description={t.admin.addBookingDescription}
    >
      {/* Remount per slot so the form re-seeds from initialDate/initialTime
          without a setState-in-effect. */}
      <BookingForm
        key={`${initialDate ?? ""}-${initialTime ?? ""}`}
        clients={clients}
        services={services}
        initialDate={initialDate}
        initialTime={initialTime}
        bookedByDate={bookedByDate}
        onClose={onClose}
      />
    </Modal>
  );
}

function BookingForm({
  clients,
  services,
  initialDate,
  initialTime,
  bookedByDate,
  onClose,
}: {
  clients: ClientProfile[];
  services: Service[];
  initialDate?: string;
  initialTime?: string;
  bookedByDate: Map<string, BookedSlot[]>;
  onClose: () => void;
}) {
  const t = useT();
  // Only real, non-admin clients can be booked from the dropdown.
  const bookableClients = clients.filter((client) => client.role !== "admin");

  const [mode, setMode] = useState<CustomerMode>("client");
  const [clientId, setClientId] = useState(bookableClients[0]?.id ?? "");
  const [customerName, setCustomerName] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState(initialDate ?? "");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const today = todayIso();

  const duration = services.find((s) => s.id === serviceId)?.duration ?? 30;
  const options = useMemo(
    () => timeOptions(duration, date ? bookedByDate.get(date) ?? [] : [], t, date),
    [duration, date, bookedByDate, t],
  );
  const [time, setTime] = useState(initialTime ?? options[0]?.value ?? "");

  // Whether the currently-selected time is unbookable for this service/day.
  const selected = options.find((option) => option.value === time);
  const timeInvalid = !selected || selected.disabled;
  const dateInvalid = Boolean(date && date < today);
  const allTaken = options.length > 0 && options.every((option) => option.disabled);

  function submit() {
    setFeedback(null);
    startTransition(async () => {
      const result = await createAdminBookingAction({
        clientId: mode === "client" ? clientId || undefined : undefined,
        customerName: mode === "walkin" ? customerName.trim() || undefined : undefined,
        serviceId,
        date,
        time,
        note: note.trim() || undefined,
      });
      setFeedback(result);
      if (result.ok) onClose();
    });
  }

  const disabled =
    pending ||
    !serviceId ||
    !date ||
    dateInvalid ||
    timeInvalid ||
    (mode === "client" ? !clientId : customerName.trim().length === 0);

  return (
    <div className="space-y-4">
        <div>
          <span className="mb-2 block text-sm font-medium text-stone-700 dark:text-stone-300">
            {t.admin.customer}
          </span>
          <SegmentedControl
            ariaLabel={t.admin.customer}
            value={mode}
            onChange={setMode}
            options={[
              { label: t.admin.existingClient, value: "client" },
              { label: t.admin.walkIn, value: "walkin" },
            ]}
          />
        </div>

        {mode === "client" ? (
          bookableClients.length > 0 ? (
            <Combobox
              label={t.admin.client}
              placeholder={t.admin.searchClients}
              value={clientId}
              onChange={setClientId}
              options={bookableClients.map((client) => ({
                value: client.id,
                label: client.email ? `${client.name} — ${client.email}` : client.name,
              }))}
            />
          ) : (
            <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-500 dark:bg-stone-800/60 dark:text-stone-400">
              {t.admin.noClientsYet}
            </p>
          )
        ) : (
          <Field
            label={t.admin.walkInName}
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder={t.admin.walkInPlaceholder}
            maxLength={120}
          />
        )}

        <SelectField
          label={t.client.service}
          value={serviceId}
          onChange={(event) => setServiceId(event.target.value)}
        >
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} — {service.duration} {t.admin.minutesShort} · {service.price} €
            </option>
          ))}
        </SelectField>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t.admin.date}
            type="date"
            value={date}
            min={today}
            onChange={(event) => setDate(event.target.value)}
          />
          <Combobox
            label={t.admin.time}
            placeholder={t.admin.typeTime}
            value={time}
            onChange={setTime}
            options={options}
          />
        </div>
        {dateInvalid ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">{t.feedback.chooseFutureTime}</p>
        ) : date && allTaken ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">{t.admin.dayFull}</p>
        ) : date && timeInvalid ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">{t.admin.slotOverlapError}</p>
        ) : null}

        <Field
          label={`${t.admin.note} ${t.common.optional}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t.admin.bookingNotePlaceholder}
          maxLength={1000}
        />

        <Feedback result={feedback && !feedback.ok ? feedback : null} />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="button" onClick={submit} disabled={disabled}>
            {pending ? t.admin.adding : t.admin.addBooking}
          </Button>
        </div>
    </div>
  );
}
