"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

import { createAdminBookingAction } from "@/app/actions";
import type { BookedSlot } from "@/components/admin/admin-calendar";
import { Button } from "@/components/shared/button";
import { Combobox } from "@/components/shared/combobox";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DateField } from "@/components/shared/date-field";
import { Feedback } from "@/components/shared/feedback";
import { Field, SelectField } from "@/components/shared/form";
import { Icon } from "@/components/shared/icon";
import { Modal } from "@/components/shared/modal";
import { SegmentedControl } from "@/components/shared/segmented-control";
import {
  addMinutesToTime,
  adminSlotOptions,
  formatFullDay,
  isPreferredClientStart,
  isSundayDate,
  minutesOf,
  formatEuroAmount,
  parseEuroCents,
  priceCentsForSlot,
  priceKindForSlot,
  todayIso,
} from "@/domain/schedule";
import type { ActionResult, BlockedInterval, BusinessHoursDay, ClientProfile, PricingSettings, Service } from "@/domain/types";
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";

type CustomerMode = "client" | "walkin";

/**
 * Warning shown before the barber books into closed hours or blocked time.
 * Used by the calendar before this modal opens and by the form itself when a
 * closed/blocked date or time is picked inside it.
 */
export function UnavailableBookingConfirm({
  open,
  onOpenChange,
  reason,
  date,
  time,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: "closed" | "blocked";
  date: string;
  time?: string;
  onConfirm: () => void;
}) {
  const t = useT();
  const locale = localeFor(useLang());
  const when = date ? t.admin.slotWhen(formatFullDay(date, locale), time) : "";
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      destructive={false}
      title={reason === "blocked" ? t.admin.unavailableConfirmBlockedTitle : t.admin.unavailableConfirmClosedTitle}
      description={reason === "blocked"
        ? t.admin.unavailableConfirmBlockedBody(when)
        : t.admin.unavailableConfirmClosedBody(when)}
      confirmLabel={t.admin.unavailableConfirmAction}
      onConfirm={onConfirm}
    />
  );
}

export function AddBookingModal({
  open,
  onClose,
  onCreated,
  clients,
  services,
  initialDate,
  initialTime,
  allowUnavailable,
  bookedByDate,
  businessHours,
  blockedIntervals,
  pricingSettings,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  clients: ClientProfile[];
  services: Service[];
  initialDate?: string;
  initialTime?: string;
  /** The barber already confirmed booking this slot outside availability. */
  allowUnavailable?: boolean;
  bookedByDate: Map<string, BookedSlot[]>;
  businessHours: BusinessHoursDay[];
  blockedIntervals: BlockedInterval[];
  pricingSettings: PricingSettings;
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
        key={`${initialDate ?? ""}-${initialTime ?? ""}-${allowUnavailable ? "override" : ""}`}
        clients={clients}
        services={services}
        initialDate={initialDate}
        initialTime={initialTime}
        allowUnavailable={allowUnavailable}
        bookedByDate={bookedByDate}
        businessHours={businessHours}
        blockedIntervals={blockedIntervals}
        pricingSettings={pricingSettings}
        onClose={onClose}
        onCreated={onCreated}
      />
    </Modal>
  );
}

function BookingForm({
  clients,
  services,
  initialDate,
  initialTime,
  allowUnavailable = false,
  bookedByDate,
  businessHours,
  blockedIntervals,
  pricingSettings,
  onClose,
  onCreated,
}: {
  clients: ClientProfile[];
  services: Service[];
  initialDate?: string;
  initialTime?: string;
  allowUnavailable?: boolean;
  bookedByDate: Map<string, BookedSlot[]>;
  businessHours: BusinessHoursDay[];
  blockedIntervals: BlockedInterval[];
  pricingSettings: PricingSettings;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useT();
  // Match the server's approved-client gate so the picker never offers a
  // customer the booking action must reject.
  const bookableClients = clients.filter(
    (client) => client.role === "client" && client.status === "approved",
  );

  const [mode, setMode] = useState<CustomerMode>("client");
  const [clientId, setClientId] = useState(bookableClients[0]?.id ?? "");
  const [customerName, setCustomerName] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState(initialDate ?? "");
  const [note, setNote] = useState("");
  const [priceInput, setPriceInput] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  // Booking into closed hours or blocked time needs an explicit confirmation,
  // given before the modal opened (calendar click) or from inside the form.
  const [overrideAvailability, setOverrideAvailability] = useState(allowUnavailable);
  const [confirmingOverride, setConfirmingOverride] = useState(false);
  const today = todayIso();

  const service = services.find((s) => s.id === serviceId);
  const duration = service?.duration ?? 30;
  const options = useMemo(
    () =>
      adminSlotOptions({
        durationMinutes: duration,
        bookedToday: date ? bookedByDate.get(date) ?? [] : [],
        date,
        businessHours,
        blockedIntervals,
        allowUnavailable: overrideAvailability,
      }).map((option) => ({
        ...option,
        disabled: option.disabledReason !== null,
        hint:
          option.disabledReason === "past"
            ? t.feedback.chooseFutureTime
            : option.disabledReason === "conflict"
              ? t.admin.slotTakenHint
              : option.unavailableReason === "blocked"
                ? t.admin.blockedShort
                : option.unavailableReason === "closed"
                  ? t.admin.off
                  : undefined,
      })),
    [duration, date, bookedByDate, businessHours, blockedIntervals, overrideAvailability, t],
  );
  const [time, setTime] = useState(initialTime ?? options[0]?.value ?? "");

  // Whether the currently-selected time is unbookable for this service/day.
  const selected = options.find((option) => option.value === time);
  const timeInvalid = !selected || selected.disabled;
  const dateInvalid = Boolean(date && date < today);
  const allTaken = options.length > 0 && options.every((option) => option.disabled);
  const dayClosed = options.length > 0 && options.every((option) => option.disabledReason === "closed");
  const selectedUnavailable = overrideAvailability && Boolean(selected?.unavailableReason);
  // Offer the override only when availability (not the past or an overlap) is
  // what makes the chosen date/time unbookable.
  const canOverride = !overrideAvailability && Boolean(date) && !dateInvalid && (
    dayClosed ||
    !selected ||
    selected.disabledReason === "closed" ||
    selected.disabledReason === "blocked"
  );
  const preferred = date && time && service
    ? isPreferredClientStart(
      date,
      minutesOf(time),
      duration,
      (bookedByDate.get(date) ?? []).map((slot) => ({
        date,
        time: slot.time,
        durationMinutes: slot.durationMinutes,
      })),
      businessHours,
    )
    : false;
  const priceKind = time ? priceKindForSlot(preferred, { startsAt: time }) : null;
  const suggestedPriceCents = service && date && time && !timeInvalid && !dateInvalid
    ? priceCentsForSlot(Math.round((isSundayDate(date) ? service.sundayPrice : service.price) * 100), preferred, {
      startsAt: time,
      ...pricingSettings,
    })
    : null;
  const suggestedPriceLabel = priceKind === "vip"
    ? t.client.vipPrice(pricingSettings.vipSurchargePercent)
    : priceKind === "gap"
      ? t.client.extraPrice(pricingSettings.gapSurchargePercent)
      : t.client.bestPrice;
  const priceValue = priceInput ?? (suggestedPriceCents === null ? "" : formatEuroAmount(suggestedPriceCents));
  const enteredPriceCents = parseEuroCents(priceValue);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enteredPriceCents === null) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await createAdminBookingAction({
          clientId: mode === "client" ? clientId || undefined : undefined,
          customerName: mode === "walkin" ? customerName.trim() || undefined : undefined,
          serviceId,
          date,
          time,
          priceCents: enteredPriceCents,
          note: note.trim() || undefined,
          allowUnavailable: selectedUnavailable,
        });
        setFeedback(result);
        if (result.ok) {
          toast.success(result.message ?? t.feedback.bookingAdded);
          onClose();
          onCreated();
        }
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  const disabled =
    pending ||
    !serviceId ||
    !date ||
    dateInvalid ||
    timeInvalid ||
    enteredPriceCents === null ||
    (mode === "client" ? !clientId : customerName.trim().length === 0);

  // Name the actual reason: a time missing from the options lies outside the
  // day's opening hours (or the service would run past closing).
  const slotHint = dateInvalid
    ? t.feedback.chooseFutureTime
    : date && dayClosed
      ? t.admin.dayClosedHint
      : date && allTaken
        ? t.admin.dayFull
        : date && timeInvalid
          ? !selected
            ? t.feedback.slotOutsideHours
            : selected.disabledReason === "past"
              ? t.feedback.chooseFutureTime
              : selected.disabledReason === "closed" || selected.disabledReason === "blocked"
                ? t.feedback.slotUnavailable
                : t.admin.slotOverlapError
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
        onChange={(event) => {
          setServiceId(event.target.value);
          setPriceInput(null);
        }}
      >
        {services.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name} — {option.duration} {t.admin.minutesShort} ·{" "}
            {date && isSundayDate(date) ? option.sundayPrice : option.price} €
          </option>
        ))}
      </SelectField>

      <div className="grid gap-4 sm:grid-cols-2">
        <DateField label={t.admin.date} value={date} min={today} onChange={(value) => {
          setDate(value);
          setPriceInput(null);
        }} />
        <Combobox
          label={t.admin.time}
          placeholder={t.admin.typeTime}
          value={time}
          onChange={(value) => {
            setTime(value);
            setPriceInput(null);
          }}
          options={options}
          searchable={false}
        />
      </div>
      {slotHint ? (
        <div className="flex flex-col items-start gap-1">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{slotHint}</p>
          {canOverride ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingOverride(true)}>
              {t.admin.bookOutsideAvailability}
            </Button>
          ) : null}
        </div>
      ) : selectedUnavailable ? (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300 tabular-nums">
          {time}–{addMinutesToTime(time, duration)} ·{" "}
          {selected?.unavailableReason === "blocked"
            ? t.admin.bookingInBlockedTimeNotice
            : t.admin.bookingOutsideHoursNotice}
        </p>
      ) : time && !timeInvalid && service ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          {time}–{addMinutesToTime(time, duration)} · {service.name}
        </p>
      ) : null}

      <Field
        label={t.admin.bookingPrice}
        value={priceValue}
        onChange={(event) => setPriceInput(event.target.value)}
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        required
        hint={suggestedPriceCents === null
          ? undefined
          : `${t.admin.suggestedPrice}: ${formatEuroAmount(suggestedPriceCents)} € · ${suggestedPriceLabel}`}
        error={priceInput !== null && enteredPriceCents === null ? t.admin.invalidBookingPrice : undefined}
      />
      {priceInput !== null && suggestedPriceCents !== null ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setPriceInput(null)}>
          {t.admin.useSuggestedPrice}
        </Button>
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

      <UnavailableBookingConfirm
        open={confirmingOverride}
        onOpenChange={setConfirmingOverride}
        reason={selected?.disabledReason === "blocked" ? "blocked" : "closed"}
        date={date}
        time={selected ? time : undefined}
        onConfirm={() => {
          setOverrideAvailability(true);
          setConfirmingOverride(false);
          setPriceInput(null);
        }}
      />
    </form>
  );
}
