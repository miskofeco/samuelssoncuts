"use client";

import { useState, useTransition } from "react";

import {
  cancelAppointmentAdminAction,
  cancelRequestAction,
  proposeAppointmentAction,
  rescheduleAppointmentAction,
} from "@/app/actions";
import { Button } from "@/components/shared/button";
import { Combobox } from "@/components/shared/combobox";
import { Feedback } from "@/components/shared/feedback";
import { Modal } from "@/components/shared/modal";
import { StatusPill } from "@/components/shared/status-pill";
import { addMinutesToTime } from "@/components/admin/admin-calendar";
import type { CalendarItem } from "@/components/admin/admin-calendar";
import { formatFullDay, workingHoursQuarterly } from "@/domain/schedule";
import type { ActionResult } from "@/domain/types";

type Mode = "view" | "reschedule" | "cancel";

export function AppointmentDetailModal({
  item,
  onClose,
}: {
  item: CalendarItem | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={item !== null}
      onClose={onClose}
      title="Appointment"
      description="View the details, propose a new time, or cancel."
    >
      {item ? <DetailBody key={item.id} item={item} onClose={onClose} /> : null}
    </Modal>
  );
}

function DetailBody({ item, onClose }: { item: CalendarItem; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("view");
  const [date, setDate] = useState(item.date);
  const [time, setTime] = useState(item.time);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);

  const isWalkIn = !item.clientId;
  const isConfirmed = item.type === "Confirmed";
  const endTime = addMinutesToTime(item.time, item.durationMinutes);

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
          <div className="min-w-0">
            <p className="text-lg font-semibold text-black dark:text-white">{item.title}</p>
            <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
              {item.service} · {item.durationMinutes} min
              {item.servicePrice ? ` · $${item.servicePrice}` : ""}
            </p>
          </div>
          <StatusPill tone={isConfirmed ? "success" : "info"}>{item.type}</StatusPill>
        </div>

        <dl className="mt-3 space-y-1.5 text-sm">
          <Row label="When">
            {formatFullDay(item.date)} · {item.time}–{endTime}
          </Row>
          {isWalkIn ? (
            <Row label="Customer">
              <StatusPill tone="neutral">Walk-in</StatusPill>
            </Row>
          ) : (
            <>
              {item.clientEmail ? <Row label="Email">{item.clientEmail}</Row> : null}
              {item.clientPhone ? <Row label="Phone">{item.clientPhone}</Row> : null}
            </>
          )}
          {item.note ? <Row label="Note">{item.note}</Row> : null}
        </dl>
      </div>

      {mode === "view" ? (
        <>
          <Feedback result={feedback && !feedback.ok ? feedback : null} />
          <div className="flex flex-wrap justify-end gap-2">
            {isWalkIn && isConfirmed ? (
              <p className="mr-auto self-center text-xs text-stone-500 dark:text-stone-400">
                Walk-in bookings can’t be rescheduled — cancel and add a new one.
              </p>
            ) : (
              <Button type="button" variant="secondary" onClick={() => setMode("reschedule")}>
                Reschedule
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode("cancel")}
              className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              Cancel appointment
            </Button>
          </div>
        </>
      ) : null}

      {mode === "reschedule" ? (
        <div className="space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            {isConfirmed
              ? "This frees the current slot and sends the client a new time to confirm."
              : "Send the client a new proposed time."}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/15 dark:bg-stone-900 dark:text-white dark:[color-scheme:dark]"
              />
            </label>
            <Combobox
              label="Time"
              placeholder="Type a time…"
              value={time}
              onChange={setTime}
              options={workingHoursQuarterly.map((hour) => ({ value: hour, label: hour }))}
            />
          </div>
          <label className="block">
            <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Message to client (optional)
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="Sorry, I need to move this — does the new time work?"
              maxLength={1000}
              className="mt-2 w-full resize-none rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/15 dark:bg-stone-900 dark:text-white"
            />
          </label>
          <Feedback result={feedback && !feedback.ok ? feedback : null} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setMode("view")}>
              Back
            </Button>
            <Button type="button" onClick={submitReschedule} disabled={pending || !date || !time}>
              {pending ? "Sending…" : "Propose new time"}
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "cancel" ? (
        <div className="space-y-4">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Cancel this appointment? This frees the slot
            {isWalkIn ? "." : " and notifies the client."}
          </p>
          {!isWalkIn ? (
            <label className="block">
              <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                Message to client (optional)
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                placeholder="Sorry, I have to cancel — please rebook when convenient."
                maxLength={1000}
                className="mt-2 w-full resize-none rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/15 dark:bg-stone-900 dark:text-white"
              />
            </label>
          ) : null}
          <Feedback result={feedback && !feedback.ok ? feedback : null} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setMode("view")}>
              Back
            </Button>
            <Button
              type="button"
              onClick={submitCancel}
              disabled={pending}
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
            >
              {pending ? "Cancelling…" : "Cancel appointment"}
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
