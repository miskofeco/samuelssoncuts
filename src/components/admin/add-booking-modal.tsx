"use client";

import { useState, useTransition } from "react";

import { createAdminBookingAction } from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Combobox } from "@/components/shared/combobox";
import { Feedback } from "@/components/shared/feedback";
import { Field, SelectField } from "@/components/shared/form";
import { Modal } from "@/components/shared/modal";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { workingHoursQuarterly } from "@/domain/schedule";
import type { ActionResult, ClientProfile, Service } from "@/domain/types";
import { useT } from "@/i18n/provider";

type CustomerMode = "client" | "walkin";

export function AddBookingModal({
  open,
  onClose,
  clients,
  services,
  initialDate,
  initialTime,
}: {
  open: boolean;
  onClose: () => void;
  clients: ClientProfile[];
  services: Service[];
  initialDate?: string;
  initialTime?: string;
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
  onClose,
}: {
  clients: ClientProfile[];
  services: Service[];
  initialDate?: string;
  initialTime?: string;
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
  const [time, setTime] = useState(initialTime ?? workingHoursQuarterly[0]);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

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
              {service.name} — {service.duration} {t.admin.minutesShort} · ${service.price}
            </option>
          ))}
        </SelectField>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t.admin.date}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <Combobox
            label={t.admin.time}
            placeholder={t.admin.typeTime}
            value={time}
            onChange={setTime}
            options={workingHoursQuarterly.map((hour) => ({ value: hour, label: hour }))}
          />
        </div>

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
