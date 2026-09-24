"use client";

import { Cancel01Icon, LockIcon, RepeatIcon } from "@hugeicons/core-free-icons";
import dynamic from "next/dynamic";
import { useId, useState, useTransition } from "react";

import {
  cancelConfirmedAppointmentAction,
  requestRescheduleAction,
} from "@/app/actions";
import { Button } from "@/components/shared/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Feedback } from "@/components/shared/feedback";
import { Icon } from "@/components/shared/icon";
import { Modal } from "@/components/shared/modal";
import { Skeleton } from "@/components/shared/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { formatFullDay } from "@/domain/schedule";
import type {
  ActionResult,
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

import type { SlotChoice } from "./slot-picker";

const SlotPicker = dynamic(
  () => import("./slot-picker").then((module) => module.SlotPicker),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full rounded-xl" /> },
);

type Props = {
  appointment: ClientAppointment;
  service: Service;
  services: Service[];
  pricingSettings: PricingSettings;
  bookedSlots: Appointment[];
  pendingRequests: BookingRequest[];
  blockedDates: ReadonlySet<string>;
  blockedIntervals: BlockedInterval[];
  businessHours: BusinessHoursDay[];
};

export function ConfirmedAppointmentActions({
  appointment,
  service,
  services,
  pricingSettings,
  bookedSlots,
  pendingRequests,
  blockedDates,
  blockedIntervals,
  businessHours,
}: Props) {
  const t = useT();
  const locale = localeFor(useLang());
  const acknowledgeId = useId();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleCutoff, setRescheduleCutoff] = useState<number | null>(null);
  const [acknowledgedRelease, setAcknowledgedRelease] = useState(false);
  const [pickerOpened, setPickerOpened] = useState(false);
  if (rescheduling && !pickerOpened) setPickerOpened(true);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotChoice | null>(null);

  function cancel() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await cancelConfirmedAppointmentAction(appointment.id);
        setFeedback(result);
        if (result.ok) setConfirmingCancel(false);
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  function submitReschedule() {
    if (!date || !slot || !acknowledgedRelease) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await requestRescheduleAction(appointment.id, date, slot.time);
        setFeedback(result);
        if (result.ok) {
          setRescheduling(false);
          setDate(null);
          setSlot(null);
        }
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  return (
    <>
      <Feedback result={feedback} className="mt-3" />

      {appointment.canModify ? (
        <div className={service.active === false
          ? "mt-4 grid gap-2 sm:flex sm:justify-end"
          : "mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end"}>
          {service.active !== false ? <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={pending}
            onClick={() => {
              setAcknowledgedRelease(false);
              setRescheduleCutoff(Date.now() + 24 * 60 * 60 * 1000);
              setRescheduling(true);
            }}
            className="sm:h-10 sm:text-sm"
          >
            <Icon icon={RepeatIcon} className="size-4" strokeWidth={2} />
            {t.client.rescheduleAppointment}
          </Button> : null}
          <Button
            type="button"
            variant="dangerOutline"
            size="lg"
            disabled={pending}
            onClick={() => setConfirmingCancel(true)}
            className="sm:h-10 sm:text-sm"
          >
            <Icon icon={Cancel01Icon} className="size-4" strokeWidth={2} />
            {t.client.cancelAppointment}
          </Button>
        </div>
      ) : (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <Icon icon={LockIcon} className="mt-px size-3.5" />
          <span>{t.client.lockedNotice}</span>
        </p>
      )}

      <ConfirmDialog
        open={confirmingCancel}
        onOpenChange={setConfirmingCancel}
        title={t.client.confirmCancelTitle}
        description={t.client.confirmCancelBody}
        confirmLabel={pending ? t.common.working : t.client.cancelAppointment}
        cancelLabel={t.client.keepAppointment}
        loading={pending}
        onConfirm={cancel}
      >
        <Feedback result={feedback && !feedback.ok ? feedback : null} />
      </ConfirmDialog>

      <Modal
        open={rescheduling}
        onClose={() => {
          setRescheduling(false);
          setAcknowledgedRelease(false);
        }}
        title={t.client.rescheduleTitle}
        description={t.client.rescheduleDescription}
        className="sm:!max-w-4xl"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              disabled={pending}
              onClick={() => setRescheduling(false)}
              className="sm:h-10 sm:text-sm"
            >
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={!date || !slot || !acknowledgedRelease}
              loading={pending}
              onClick={submitReschedule}
              className="sm:h-10 sm:text-sm"
            >
              {pending ? t.common.sending : t.client.rescheduleSubmit}
            </Button>
          </>
        }
      >
        <Feedback result={feedback && !feedback.ok ? feedback : null} className="mb-3" />
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground">
          <p>{t.client.rescheduleReleaseWarning(`${formatFullDay(appointment.date, locale)} · ${appointment.time}`)}</p>
          <label htmlFor={acknowledgeId} className="mt-3 flex cursor-pointer items-start gap-2 font-medium">
            <Checkbox
              id={acknowledgeId}
              checked={acknowledgedRelease}
              onCheckedChange={(checked) => setAcknowledgedRelease(checked === true)}
              className="mt-0.5"
            />
            <span>{t.client.rescheduleAcknowledge}</span>
          </label>
        </div>
        {pickerOpened ? (
          <SlotPicker
            service={service}
            services={services}
            pricingSettings={pricingSettings}
            date={date}
            onDateChange={(next) => {
              setDate(next);
              setSlot(null);
            }}
            selectedTime={slot?.time ?? null}
            selectedChoice={slot}
            onSelectTime={setSlot}
            onInvalidSelection={() => setSlot(null)}
            appointments={bookedSlots}
            pendingRequests={pendingRequests}
            blockedDates={blockedDates}
            blockedIntervals={blockedIntervals}
            businessHours={businessHours}
            earliestStartMs={rescheduleCutoff ?? undefined}
            excludeAppointment={appointment}
          />
        ) : null}
      </Modal>
    </>
  );
}
