"use client";

import { useMemo, useState, useTransition } from "react";

import {
  cancelAppointmentAdminAction,
  cancelRequestAction,
  markAppointmentOutcomeAction,
  proposeAppointmentAction,
  rescheduleAppointmentAction,
} from "@/app/actions";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/shared/button";
import { Combobox } from "@/components/shared/combobox";
import { Feedback } from "@/components/shared/feedback";
import { Modal } from "@/components/shared/modal";
import { StatusPill } from "@/components/shared/status-pill";
import { addMinutesToTime } from "@/components/admin/admin-calendar";
import type { BookedSlot, CalendarItem } from "@/components/admin/admin-calendar";
import { formatFullDay, minutesOf, overlaps, slotsForService, todayIso } from "@/domain/schedule";
import type { ActionResult } from "@/domain/types";
import { localeFor } from "@/i18n/config";
import type { Dict } from "@/i18n/dictionaries";
import { useLang, useT } from "@/i18n/provider";

type Mode = "view" | "reschedule" | "cancel";

// Reschedule time options for a service duration, disabling slots that overlap
// any *other* booking on `date` (the appointment being moved is excluded).
function rescheduleOptions(
  durationMinutes: number,
  bookedToday: BookedSlot[],
  excludeId: string | undefined,
  t: Dict,
  date?: string,
) {
  const now = new Date();
  const today = todayIso();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slotsForService(durationMinutes).map((time) => {
    const startMin = minutesOf(time);
    const clash = bookedToday.some(
      (slot) =>
        slot.id !== excludeId &&
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

export function AppointmentDetailModal({
  item,
  onClose,
  bookedByDate,
}: {
  item: CalendarItem | null;
  onClose: () => void;
  bookedByDate: Map<string, BookedSlot[]>;
}) {
  const t = useT();
  return (
    <Modal
      open={item !== null}
      onClose={onClose}
      title={t.admin.appointment}
      description={t.admin.appointmentDescription}
    >
      {item ? (
        <DetailBody key={item.id} item={item} onClose={onClose} bookedByDate={bookedByDate} />
      ) : null}
    </Modal>
  );
}

function DetailBody({
  item,
  onClose,
  bookedByDate,
}: {
  item: CalendarItem;
  onClose: () => void;
  bookedByDate: Map<string, BookedSlot[]>;
}) {
  const t = useT();
  const locale = localeFor(useLang());
  const [mode, setMode] = useState<Mode>("view");
  const [date, setDate] = useState(item.date);
  const [time, setTime] = useState(item.time);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const today = todayIso();

  const isWalkIn = !item.clientId;
  const isConfirmed = item.type === "Confirmed";
  const endTime = addMinutesToTime(item.time, item.durationMinutes);

  const timeOptions = useMemo(
    () =>
      rescheduleOptions(
        item.durationMinutes,
        date ? bookedByDate.get(date) ?? [] : [],
        item.id,
        t,
        date,
      ),
    [item.durationMinutes, item.id, date, bookedByDate, t],
  );
  const selectedOption = timeOptions.find((option) => option.value === time);
  const timeInvalid = !selectedOption || selectedOption.disabled;
  const dateInvalid = Boolean(date && date < today);

  function run(action: () => Promise<ActionResult>) {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      setFeedback(result);
      if (result.ok) onClose();
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
      // Proposed: re-propose against the same request (nothing booked yet).
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
      // Proposed: cancel the underlying request.
      run(() => cancelRequestAction(item.requestId as string));
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            {!isWalkIn ? (
              <Avatar size="md" name={item.title} src={item.clientAvatarUrl} />
            ) : null}
            <div className="min-w-0">
              <p className="text-lg font-semibold text-black dark:text-white">{item.title}</p>
              <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
                {item.service} · {item.durationMinutes} {t.admin.minutesShort}
                {item.servicePrice ? ` · ${item.servicePrice} €` : ""}
              </p>
            </div>
          </div>
          <StatusPill tone={isConfirmed ? "success" : "info"}>
            {isConfirmed ? t.admin.confirmed : t.statuses.proposedShort}
          </StatusPill>
        </div>

        <dl className="mt-3 space-y-1.5 text-sm">
          <Row label={t.admin.when}>
            {formatFullDay(item.date, locale)} · {item.time}–{endTime}
          </Row>
          {isWalkIn ? (
            <Row label={t.admin.customer}>
              <StatusPill tone="neutral">{t.admin.walkIn}</StatusPill>
            </Row>
          ) : (
            <>
              {item.clientEmail ? <Row label={t.common.email}>{item.clientEmail}</Row> : null}
              {item.clientPhone ? <Row label={t.common.phone}>{item.clientPhone}</Row> : null}
            </>
          )}
          {item.note ? <Row label={t.admin.note}>{item.note}</Row> : null}
        </dl>
      </div>

      {mode === "view" ? (
        <>
          <Feedback result={feedback && !feedback.ok ? feedback : null} />

          {/* Outcome section — only for past confirmed appointments */}
          {isConfirmed && item.date < today ? (
            item.outcome ? (
              <div className="flex items-center gap-2">
                <StatusPill tone={item.outcome === "completed" ? "success" : "danger"}>
                  {item.outcome === "completed" ? t.admin.outcomeCompleted : t.admin.outcomeNoShow}
                </StatusPill>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    run(() => markAppointmentOutcomeAction(item.appointmentId!, "completed"))
                  }
                >
                  {t.admin.markCompleted}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    run(() => markAppointmentOutcomeAction(item.appointmentId!, "no_show"))
                  }
                  className="text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
                >
                  {t.admin.markNoShow}
                </Button>
              </div>
            )
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            {isWalkIn && isConfirmed ? (
              <p className="mr-auto self-center text-xs text-stone-500 dark:text-stone-400">
                {t.admin.walkInNoReschedule}
              </p>
            ) : (
              <Button type="button" variant="secondary" onClick={() => setMode("reschedule")}>
                {t.admin.reschedule}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode("cancel")}
              className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              {t.admin.cancelAppointment}
            </Button>
          </div>
        </>
      ) : null}

      {mode === "reschedule" ? (
        <div className="space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            {isConfirmed
              ? t.admin.rescheduleConfirmedDescription
              : t.admin.rescheduleProposedDescription}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{t.admin.date}</span>
              <input
                type="date"
                value={date}
                min={today}
                onChange={(event) => setDate(event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/15 dark:bg-stone-900 dark:text-white dark:[color-scheme:dark]"
              />
            </label>
            <Combobox
              label={t.admin.time}
              placeholder={t.admin.typeTime}
              value={time}
              onChange={setTime}
              options={timeOptions}
            />
          </div>
          {dateInvalid ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">{t.feedback.chooseFutureTime}</p>
          ) : timeInvalid ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">{t.admin.slotOverlapError}</p>
          ) : null}
          <label className="block">
            <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
              {`${t.admin.messageToClient} ${t.common.optional}`}
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder={t.admin.rescheduleNotePlaceholder}
              maxLength={1000}
              className="mt-2 w-full resize-none rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/15 dark:bg-stone-900 dark:text-white"
            />
          </label>
          <Feedback result={feedback && !feedback.ok ? feedback : null} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setMode("view")}>
              {t.common.back}
            </Button>
            <Button
              type="button"
              onClick={submitReschedule}
              disabled={pending || !date || !time || dateInvalid || timeInvalid}
            >
              {pending ? t.common.sending : t.admin.proposeNewTime}
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "cancel" ? (
        <div className="space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            {t.admin.cancelConfirmBase}
            {isWalkIn ? t.admin.cancelConfirmWalkIn : t.admin.cancelConfirmClient}
          </p>
          {!isWalkIn ? (
            <label className="block">
              <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                {`${t.admin.messageToClient} ${t.common.optional}`}
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                placeholder={t.admin.cancelNotePlaceholder}
                maxLength={1000}
                className="mt-2 w-full resize-none rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/15 dark:bg-stone-900 dark:text-white"
              />
            </label>
          ) : null}
          <Feedback result={feedback && !feedback.ok ? feedback : null} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setMode("view")}>
              {t.common.back}
            </Button>
            <Button
              type="button"
              onClick={submitCancel}
              disabled={pending}
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
            >
              {pending ? t.admin.cancelling : t.admin.cancelAppointment}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 text-stone-500 dark:text-stone-400">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-black dark:text-white">{children}</dd>
    </div>
  );
}
