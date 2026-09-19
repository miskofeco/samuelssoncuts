"use client";

import { Cancel01Icon, LockIcon, RepeatIcon } from "@hugeicons/core-free-icons";
import { useState, useTransition } from "react";

import {
  cancelConfirmedAppointmentAction,
  requestRescheduleAction,
} from "@/app/actions";
import { Button } from "@/components/shared/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Feedback } from "@/components/shared/feedback";
import { Icon } from "@/components/shared/icon";
import { Modal } from "@/components/shared/modal";
import type {
  ActionResult,
  Appointment,
  BookingRequest,
  BusinessHoursDay,
  ClientAppointment,
  PricingSettings,
  Service,
} from "@/domain/types";
import { useT } from "@/i18n/provider";

import { SlotPicker, type SlotChoice } from "./slot-picker";

type Props = {
  appointment: ClientAppointment;
  service: Service;
  services: Service[];
  pricingSettings: PricingSettings;
  bookedSlots: Appointment[];
  pendingRequests: BookingRequest[];
  blockedDates: ReadonlySet<string>;
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
  businessHours,
}: Props) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
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
    if (!date || !slot) return;
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
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={pending}
            onClick={() => setRescheduling(true)}
            className="sm:h-10 sm:text-sm"
          >
            <Icon icon={RepeatIcon} className="size-4" strokeWidth={2} />
            {t.client.rescheduleAppointment}
          </Button>
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
        onClose={() => setRescheduling(false)}
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
              disabled={!date || !slot}
              loading={pending}
              onClick={submitReschedule}
              className="sm:h-10 sm:text-sm"
            >
              {pending ? t.common.sending : t.client.rescheduleSubmit}
            </Button>
          </>
        }
      >
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
          onSelectTime={setSlot}
          appointments={bookedSlots}
          pendingRequests={pendingRequests}
          blockedDates={blockedDates}
          businessHours={businessHours}
        />
      </Modal>
    </>
  );
}
