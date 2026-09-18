"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

import { createAdminBookingAction } from "@/app/actions";
import type { BookedSlot } from "@/components/admin/admin-calendar";
import { Button } from "@/components/shared/button";
import { Combobox } from "@/components/shared/combobox";
import { DateField } from "@/components/shared/date-field";
import { Feedback } from "@/components/shared/feedback";
import { Field, SelectField } from "@/components/shared/form";
import { Icon } from "@/components/shared/icon";
import { Modal } from "@/components/shared/modal";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { addMinutesToTime, adminSlotOptions, todayIso } from "@/domain/schedule";
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

  const service = services.find((s) => s.id === serviceId);
  const duration = service?.duration ?? 30;
  const options = useMemo(
    () =>
      adminSlotOptions({
        durationMinutes: duration,
        bookedToday: date ? bookedByDate.get(date) ?? [] : [],
        date,
      }).map((option) => ({
        ...option,
        disabled: option.disabledReason !== null,
        hint:
          option.disabledReason === "past"
            ? t.feedback.chooseFutureTime
            : option.disabledReason === "conflict"
              ? t.admin.slotTakenHint
              : undefined,
      })),
    [duration, date, bookedByDate, t],
  );
  const [time, setTime] = useState(initialTime ?? options[0]?.value ?? "");

  // Whether the currently-selected time is unbookable for this service/day.
  const selected = options.find((option) => option.value === time);
  const timeInvalid = !selected || selected.disabled;
  const dateInvalid = Boolean(date && date < today);
  const allTaken = options.length > 0 && options.every((option) => option.disabled);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      if (result.ok) {
        toast.success(result.message ?? t.feedback.bookingAdded);
        onClose();
      }
    });
  }

  const disabled =
    pending ||
    !serviceId ||
    !date ||
    dateInvalid ||
    timeInvalid ||
    (mode === "client" ? !clientId : customerName.trim().length === 0);

  const slotHint = dateInvalid
    ? t.feedback.chooseFutureTime
    : date && allTaken
      ? t.admin.dayFull
      : date && timeInvalid
        ? t.admin.slotOverlapError
        : null;

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-foreground">{t.admin.customer}</span>
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
          <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
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
          autoComplete="off"
        />
      )}

      <SelectField
        label={t.client.service}
        value={serviceId}
        onChange={(event) => setServiceId(event.target.value)}
      >
        {services.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name} — {option.duration} {t.admin.minutesShort} · {option.price} €
          </option>
        ))}
      </SelectField>

      <div className="grid gap-4 sm:grid-cols-2">
        <DateField label={t.admin.date} value={date} min={today} onChange={setDate} />
        <Combobox
          label={t.admin.time}
          placeholder={t.admin.typeTime}
          value={time}
          onChange={setTime}
          options={options}
          searchable={false}
        />
      </div>
      {slotHint ? (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{slotHint}</p>
      ) : time && !timeInvalid && service ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          {time}–{addMinutesToTime(time, duration)} · {service.name} · {service.price} €
        </p>
      ) : null}

      <Field
        label={`${t.admin.note} ${t.common.optional}`}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t.admin.bookingNotePlaceholder}
        maxLength={1000}
      />

      <Feedback result={feedback && !feedback.ok ? feedback : null} />

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="lg" onClick={onClose}>
          {t.common.cancel}
        </Button>
        <Button type="submit" size="lg" disabled={disabled} loading={pending}>
          {pending ? (
            t.admin.adding
          ) : (
            <>
              <Icon icon={Add01Icon} strokeWidth={2.2} />
              {t.admin.addBooking}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
