"use client";

import {
  Calendar03Icon,
  Call02Icon,
  Mail01Icon,
  Note01Icon,
  Scissor01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { useMemo, useState, useTransition } from "react";

import {
  cancelAppointmentAdminAction,
  confirmRequestAction,
  declineRequestAdminAction,
  markAppointmentOutcomeAction,
  proposeAppointmentAction,
  rescheduleAppointmentAction,
} from "@/app/actions";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/shared/button";
import { Combobox } from "@/components/shared/combobox";
import { DateField } from "@/components/shared/date-field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Feedback } from "@/components/shared/feedback";
import { TextAreaField } from "@/components/shared/form";
import { Icon } from "@/components/shared/icon";
import { Modal } from "@/components/shared/modal";
import { StatusPill } from "@/components/shared/status-pill";
import type { BookedSlot, CalendarItem } from "@/components/admin/admin-calendar";
import { addMinutesToTime, adminSlotOptions, formatFullDay, todayIso } from "@/domain/schedule";
import type { ActionResult, BlockedInterval, BusinessHoursDay } from "@/domain/types";
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";
import { shopDateTimeToEpochMs } from "@/lib/time-zone";

type Mode = "view" | "reschedule";

export function AppointmentDetailModal({
  item,
  onClose,
  bookedByDate,
  businessHours,
  blockedIntervals,
}: {
  item: CalendarItem | null;
  onClose: () => void;
  bookedByDate: Map<string, BookedSlot[]>;
  businessHours: BusinessHoursDay[];
  blockedIntervals: BlockedInterval[];
}) {
  const t = useT();
  return (
    <Modal
      open={item !== null}
      onClose={onClose}
      title={item?.type === "Proposed" ? t.admin.appointmentRequests : t.admin.appointment}
      description={item?.type === "Proposed" ? t.admin.calendarRequestDescription : t.admin.appointmentDescription}
    >
      {item ? (
        <DetailBody key={item.id} item={item} onClose={onClose} bookedByDate={bookedByDate}
          businessHours={businessHours} blockedIntervals={blockedIntervals} />
      ) : null}
    </Modal>
  );
}

function DetailBody({
  item,
  onClose,
  bookedByDate,
  businessHours,
  blockedIntervals,
}: {
  item: CalendarItem;
  onClose: () => void;
  bookedByDate: Map<string, BookedSlot[]>;
  businessHours: BusinessHoursDay[];
  blockedIntervals: BlockedInterval[];
}) {
  const t = useT();
  const locale = localeFor(useLang());
  const [mode, setMode] = useState<Mode>("view");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [date, setDate] = useState(item.date);
  const [time, setTime] = useState(item.time);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  // Snapshot the clock once per opened appointment (the body is keyed by item
  // id) so render stays pure while "has this ended" is still current enough.
  const [openedAt] = useState(() => Date.now());
  const today = todayIso();

  const isWalkIn = !item.clientId;
  const isConfirmed = item.type !== "Proposed";
  const isPendingRequest = item.type === "Proposed" && item.requestStatus === "pending";
  const endTime = addMinutesToTime(item.time, item.durationMinutes);
  const hasEnded = shopDateTimeToEpochMs(item.date, endTime) <= openedAt;
  const canManage = !isConfirmed || (!hasEnded && !item.outcome);
  const canConfirmRequest = isPendingRequest && shopDateTimeToEpochMs(item.date, item.time) > openedAt;
  const finalPrice = (item.finalPriceCents / 100).toFixed(2);

  const timeOptions = useMemo(
    () =>
      adminSlotOptions({
        durationMinutes: item.durationMinutes,
        bookedToday: date ? bookedByDate.get(date) ?? [] : [],
        excludeId: item.id,
        date,
        businessHours,
        blockedIntervals,
      }).map((option) => ({
        ...option,
        disabled: option.disabledReason !== null,
        hint:
          option.disabledReason === "past"
            ? t.feedback.chooseFutureTime
            : option.disabledReason === "conflict"
              ? t.admin.slotTakenHint
              : option.disabledReason === "closed" || option.disabledReason === "blocked"
                ? t.admin.off
              : undefined,
      })),
    [item.durationMinutes, item.id, date, bookedByDate, businessHours, blockedIntervals, t],
  );
  const selectedOption = timeOptions.find((option) => option.value === time);
  const timeInvalid = !selectedOption || selectedOption.disabled;
  const dateInvalid = Boolean(date && date < today);

  function run(action: () => Promise<ActionResult>) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await action();
        setFeedback(result);
        if (result.ok) onClose();
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  function submitReschedule() {
    if (isConfirmed) {
      run(() =>
        rescheduleAppointmentAction({
          appointmentId: item.appointmentId,
          date,
          time,
          note: note.trim() || undefined,
        }),
      );
    } else {
      // An open request can receive a different time; nothing is booked yet.
      run(() =>
        proposeAppointmentAction({
          requestId: item.requestId,
          date,
          time,
          note: note.trim() || undefined,
        }),
      );
    }
  }

  function submitCancel() {
    if (isConfirmed) {
      run(() =>
        cancelAppointmentAdminAction({
          appointmentId: item.appointmentId,
          note: note.trim() || undefined,
        }),
      );
    } else if (item.requestId) {
      run(() =>
        declineRequestAdminAction({
          requestId: item.requestId,
          reason: note.trim() || undefined,
        }),
      );
    }
  }

  function submitConfirmRequest() {
    if (canConfirmRequest && item.requestId) {
      run(() => confirmRequestAction(item.requestId as string));
    }
  }

  const errorFeedback = feedback && !feedback.ok ? feedback : null;
  // Cron may infer "completed" before the barber records a no-show. Keep the
  // opposite action available so attendance can be corrected afterward.
  const canRecordOutcome = isConfirmed && hasEnded;

  return (
    <div className="space-y-4">
      {/* Who */}
      <div className="flex items-start gap-3">
        {isWalkIn ? (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon icon={UserIcon} className="size-5" />
          </span>
        ) : (
          <Avatar size="lg" name={item.title} src={item.clientAvatarUrl} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-foreground">{item.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusPill tone={isConfirmed ? "success" : isPendingRequest ? "warning" : "info"} dot>
              {isConfirmed
                ? t.admin.confirmed
                : isPendingRequest
                  ? t.admin.statusNewRequest
                  : t.admin.statusAwaitingClient}
            </StatusPill>
            {isWalkIn ? <StatusPill tone="neutral">{t.admin.walkIn}</StatusPill> : null}
            {item.outcome === "completed" || item.outcome === "no_show" ? (
              <StatusPill tone={item.outcome === "completed" ? "success" : "danger"}>
                {item.outcome === "completed" ? t.admin.outcomeCompleted : t.admin.outcomeNoShow}
              </StatusPill>
            ) : null}
          </div>
        </div>
      </div>

      {/* What / when / contact */}
      <dl className="divide-y rounded-xl bg-muted/40 ring-1 ring-foreground/10">
        <DetailRow icon={Scissor01Icon} label={t.client.service}>
          {item.service} · {item.durationMinutes} {t.admin.minutesShort}
        </DetailRow>
        <DetailRow icon={Calendar03Icon} label={t.admin.when}>
          {formatFullDay(item.date, locale)}
          <span className="block text-muted-foreground tabular-nums">
            {item.time}–{endTime}
          </span>
        </DetailRow>
        {!isWalkIn && item.clientEmail ? (
          <DetailRow icon={Mail01Icon} label={t.common.email}>
            <a href={`mailto:${item.clientEmail}`} className="break-all underline-offset-4 hover:underline">
              {item.clientEmail}
            </a>
          </DetailRow>
        ) : null}
        {!isWalkIn && item.clientPhone ? (
          <DetailRow icon={Call02Icon} label={t.common.phone}>
            <a href={`tel:${item.clientPhone}`} className="tabular-nums underline-offset-4 hover:underline">
              {item.clientPhone}
            </a>
          </DetailRow>
        ) : null}
        {item.note ? (
          <DetailRow icon={Note01Icon} label={t.admin.note}>
            {item.note}
          </DetailRow>
        ) : null}
      </dl>

      {/* Price */}
      <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-500/10 px-4 py-3 ring-1 ring-emerald-500/20 dark:bg-emerald-400/10">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-emerald-800 uppercase dark:text-emerald-300">
            {isConfirmed ? t.admin.finalPrice : t.admin.requestedPrice}
          </p>
          {item.surcharge ? (
            <p
              className={
                item.surchargeKind === "vip"
                  ? "mt-0.5 text-xs font-medium text-sky-700 dark:text-sky-300"
                  : "mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-300"
              }
            >
              {item.surchargeKind === "vip"
                ? t.admin.vipSurcharge(item.surchargePercent ?? 0)
                : t.admin.gapSurcharge(item.surchargePercent ?? 0)}
            </p>
          ) : null}
        </div>
        <p className="text-2xl font-semibold text-foreground tabular-nums">{finalPrice} €</p>
      </div>

      {mode === "view" ? (
        <>
          <Feedback result={errorFeedback} />

          {/* Outcome — only for confirmed appointments that already ended */}
          {canRecordOutcome ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {item.outcome !== "completed" ? (
                <Button
                  type="button"
                  size="lg"
                  loading={pending}
                  onClick={() => run(() => markAppointmentOutcomeAction(item.appointmentId!, "completed"))}
                >
                  {t.admin.markCompleted}
                </Button>
              ) : null}
              {item.outcome !== "no_show" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={pending}
                  onClick={() => setNoShowOpen(true)}
                  className="text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                >
                  {t.admin.markNoShow}
                </Button>
              ) : null}
            </div>
          ) : null}

          {canManage ? (
            <div className="grid gap-2 border-t pt-4 sm:grid-cols-2">
              {isWalkIn && isConfirmed ? (
                <p className="self-center text-xs text-muted-foreground">
                  {t.admin.walkInNoReschedule}
                </p>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className={canConfirmRequest ? "w-full sm:col-span-2" : "w-full"}
                  onClick={() => setMode("reschedule")}
                >
                  {isConfirmed ? t.admin.reschedule : t.admin.proposeNewTime}
                </Button>
              )}
              <Button
                type="button"
                variant="destructive-outline"
                size="lg"
                className="w-full"
                disabled={pending}
                onClick={() => setCancelOpen(true)}
              >
                {isConfirmed ? t.admin.cancelAppointment : t.admin.declineRequest}
              </Button>
              {canConfirmRequest ? (
                <Button type="button" size="lg" className="w-full" loading={pending} onClick={submitConfirmRequest}>
                  {t.admin.confirmRequest}
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <div className="space-y-4 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {isConfirmed
              ? t.admin.rescheduleConfirmedDescription
              : t.admin.rescheduleProposedDescription}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField
              label={t.admin.date}
              value={date}
              min={today}
              onChange={setDate}
              error={dateInvalid ? t.feedback.chooseFutureTime : undefined}
            />
            <Combobox
              label={t.admin.time}
              placeholder={t.admin.typeTime}
              value={time}
              onChange={setTime}
              options={timeOptions}
              searchable={false}
            />
          </div>
          {!dateInvalid && timeInvalid ? (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{t.admin.slotOverlapError}</p>
          ) : null}
          <TextAreaField
            label={`${t.admin.messageToClient} ${t.common.optional}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder={t.admin.rescheduleNotePlaceholder}
            maxLength={1000}
          />
          <Feedback result={errorFeedback} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="lg" onClick={() => setMode("view")}>
              {t.common.back}
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={submitReschedule}
              loading={pending}
              disabled={!date || !time || dateInvalid || timeInvalid}
            >
              {pending
                ? t.common.sending
                : isConfirmed
                  ? t.admin.reschedule
                  : t.admin.proposeNewTime}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={isConfirmed ? t.admin.cancelAppointment : t.admin.declineRequestTitle}
        description={isConfirmed
          ? `${t.admin.cancelConfirmBase}${isWalkIn ? t.admin.cancelConfirmWalkIn : t.admin.cancelConfirmClient}`
          : t.admin.declineRequestBody}
        confirmLabel={pending
          ? t.admin.cancelling
          : isConfirmed
            ? t.admin.cancelAppointment
            : t.admin.declineRequest}
        loading={pending}
        onConfirm={submitCancel}
      >
        <div className="space-y-3">
          {!isWalkIn ? (
            <TextAreaField
              label={isConfirmed ? `${t.admin.messageToClient} ${t.common.optional}` : t.admin.declineRequestReason}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder={isConfirmed ? t.admin.cancelNotePlaceholder : t.admin.declineRequestReasonPlaceholder}
              maxLength={1000}
            />
          ) : null}
          <Feedback result={errorFeedback} />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={noShowOpen}
        onOpenChange={setNoShowOpen}
        title={t.admin.noShowConfirmTitle}
        description={t.admin.noShowConfirmBody}
        confirmLabel={t.admin.markNoShow}
        loading={pending}
        onConfirm={() => run(() => markAppointmentOutcomeAction(item.appointmentId!, "no_show"))}
      >
        <Feedback result={errorFeedback} />
      </ConfirmDialog>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: IconSvgElement;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <Icon icon={icon} className="mt-0.5 size-4 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium break-words text-foreground">{children}</dd>
      </div>
    </div>
  );
}
