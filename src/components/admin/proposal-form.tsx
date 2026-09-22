"use client";

import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Calendar03Icon,
  CalendarAdd01Icon,
  CheckmarkCircle02Icon,
  HourglassIcon,
  Note01Icon,
  Scissor01Icon,
} from "@hugeicons/core-free-icons";
import { useCallback, useMemo, useState, useTransition } from "react";

import {
  confirmRequestAction,
  declineRequestAdminAction,
  proposeTimeFromAdminAction,
} from "@/app/actions";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/shared/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Feedback } from "@/components/shared/feedback";
import { DateField } from "@/components/shared/date-field";
import { SelectField, TextAreaField } from "@/components/shared/form";
import { Icon } from "@/components/shared/icon";
import { StatusPill } from "@/components/shared/status-pill";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { requiresAdminRequestAction } from "@/domain/request-actionability";
import {
  addDays,
  dayCapacity,
  formatDay,
  formatMonth,
  hoursInWindow,
  monthGrid,
  monthKey,
  minutesOf,
  overlaps,
  serviceById,
  shiftMonth,
  todayIso,
  windowForTime,
  workingHours,
} from "@/domain/schedule";
import type {
  ActionResult,
  Appointment,
  BookingRequest,
  ClientProfile,
  DayWindow,
  Preference,
  Proposal,
  RequestStatus,
  Service,
} from "@/domain/types";
import { localeFor } from "@/i18n/config";
import { useLang, useT } from "@/i18n/provider";
import type { Dict } from "@/i18n/dictionaries";
import { cn } from "@/lib/classnames";

const statusTone: Record<
  RequestStatus,
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  pending: "warning",
  proposed: "info",
  confirmed: "success",
  declined: "danger",
};

function statusLabel(t: Dict, status: RequestStatus) {
  switch (status) {
    case "pending":
      return t.admin.statusNewRequest;
    case "proposed":
      return t.admin.statusAwaitingClient;
    case "confirmed":
      return t.admin.statusConfirmed;
    case "declined":
      return t.admin.statusDeclined;
  }
}

/**
 * One booking request card. The header toggles the body; a pending exact-slot
 * request shows the requested time with confirm/decline up front and hides the
 * "propose another time" controls in a collapsible that starts closed.
 */
export function ProposalComposer({
  appointments,
  client,
  request,
  services,
  activeProposal,
  blockedDates,
}: {
  appointments: Appointment[];
  client?: ClientProfile;
  request: BookingRequest;
  services: Service[];
  activeProposal?: Proposal;
  blockedDates: ReadonlySet<string>;
}) {
  const t = useT();
  const locale = localeFor(useLang());
  const service = serviceById(request.serviceId, services);
  const tone = statusTone[request.status];
  const label = statusLabel(t, request.status);
  const canPropose = requiresAdminRequestAction(request.status);
  // The client picked an exact slot (new flow) and it's awaiting confirmation.
  const hasChosenSlot = Boolean(request.requestedDate && request.requestedTime);
  const hasDetails =
    Boolean(request.note) ||
    request.preferences.length > 0 ||
    canPropose ||
    (!hasChosenSlot && request.status === "proposed");
  // Reliability signal at decision time: how many times this client no-showed.
  const clientNoShows = client
    ? appointments.filter((a) => a.clientId === client.id && a.outcome === "no_show").length
    : 0;

  // Declared before the state initialisers that call them (React Compiler
  // requires declaration-before-use for values read during render).
  const takenAt = useCallback(
    (targetDate: string, targetTime: string) => {
      if (blockedDates.has(targetDate)) return true;
      const start = minutesOf(targetTime);
      return appointments.some((appointment) => {
        if (appointment.date !== targetDate) return false;
        const appointmentService = serviceById(appointment.serviceId, services);
        return overlaps(
          start,
          service.duration,
          minutesOf(appointment.time),
          appointmentService.duration,
        );
      });
    },
    [appointments, blockedDates, services, service.duration],
  );

  function firstFreeTime(targetDate: string) {
    return workingHours.find((hour) => !takenAt(targetDate, hour)) ?? workingHours[0];
  }

  const [open, setOpen] = useState(hasDetails && request.status !== "pending");
  const [proposalControlsOpen, setProposalControlsOpen] = useState(false);
  const initialDate = request.preferences[0]?.date ?? addDays(1);
  const [date, setDate] = useState(initialDate);
  const [windowFilter, setWindowFilter] = useState<DayWindow | "all">(
    request.preferences[0]?.window ?? "all",
  );
  const [time, setTime] = useState(() => firstFreeTime(initialDate));
  const [note, setNote] = useState(t.admin.defaultProposalNote);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const bodyId = `request-body-${request.id}`;

  const slots = useMemo(() => {
    const base = windowFilter === "all" ? workingHours : hoursInWindow(windowFilter);
    return base.map((hour) => ({
      hour,
      taken: takenAt(date, hour),
    }));
  }, [date, windowFilter, takenAt]);

  function chooseDate(targetDate: string) {
    setDate(targetDate);
    const free = firstFreeTime(targetDate);
    setTime(free);
    setWindowFilter("all");
  }

  function choosePreference(preferenceDate: string, preferenceWindow: DayWindow) {
    setDate(preferenceDate);
    setWindowFilter(preferenceWindow);
    const candidates = hoursInWindow(preferenceWindow).filter(
      (hour) => !takenAt(preferenceDate, hour),
    );
    setTime(candidates[0] ?? firstFreeTime(preferenceDate));
  }

  function submit() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await proposeTimeFromAdminAction(request.id, date, time, note);
        setFeedback(result);
        if (result.ok) setOpen(false);
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  function confirm() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await confirmRequestAction(request.id);
        setFeedback(result);
        if (result.ok) setOpen(false);
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  function decline() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await declineRequestAdminAction({
          requestId: request.id,
          reason: declineReason.trim() || undefined,
        });
        setFeedback(result);
        if (result.ok) {
          setDeclineOpen(false);
          setOpen(false);
        }
      } catch {
        setFeedback({ ok: false, error: t.common.somethingWentWrong });
      }
    });
  }

  const conflict = takenAt(date, time);
  const clientName = client?.name ?? t.admin.clientFallback;
  const headerContent = (
    <>
      <div className="flex min-w-0 items-start gap-3">
        <Avatar size="md" name={clientName} src={client?.avatarUrl} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-base font-semibold text-foreground">{clientName}</p>
            <StatusPill tone={tone} dot>
              {label}
            </StatusPill>
            {clientNoShows > 0 ? (
              <StatusPill tone="warning">
                <Icon icon={Alert02Icon} className="size-3.5" strokeWidth={2} />
                {clientNoShows}{" "}
                {clientNoShows === 1 ? t.admin.reliabilityFlag : t.admin.reliabilityFlagPlural}
              </StatusPill>
            ) : null}
          </div>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <Icon icon={Scissor01Icon} className="size-3.5" />
            <span className="truncate">
              {service.name} · {service.duration} {t.admin.minutesShort}
              {client?.email ? ` · ${client.email}` : ""}
            </span>
          </p>
        </div>
      </div>
      {hasDetails ? (
        <span
          className={cn(
            "mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-transform",
            open ? "rotate-180" : "",
          )}
          aria-hidden
        >
          <Icon icon={ArrowDown01Icon} />
        </span>
      ) : null}
    </>
  );

  return (
    <article
      className={cn(
        "rounded-xl bg-card text-card-foreground shadow-xs ring-1 transition",
        request.status === "pending" ? "ring-amber-500/40" : "ring-foreground/10",
      )}
    >
      {/* Only rows with additional details behave like disclosure controls. */}
      {hasDetails ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex w-full items-start justify-between gap-3 rounded-t-xl p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          {headerContent}
        </button>
      ) : (
        <div className="flex w-full items-start justify-between gap-3 p-4">{headerContent}</div>
      )}

      {/* Confirmed summary */}
      {request.status === "confirmed" && activeProposal ? (
        <SummaryBanner tone="success" icon={CheckmarkCircle02Icon}>
          {t.admin.bookedConfirmed(formatDay(activeProposal.date, locale), activeProposal.time)}
        </SummaryBanner>
      ) : null}

      {/* Proposed summary */}
      {request.status === "proposed" && activeProposal ? (
        <SummaryBanner tone="info" icon={HourglassIcon}>
          {t.admin.proposedWaiting(formatDay(activeProposal.date, locale), activeProposal.time)}
        </SummaryBanner>
      ) : null}

      {/* Chosen-slot summary + one-click confirm (new exact-slot flow) */}
      {request.status === "pending" && hasChosenSlot ? (
        <div className="border-t px-4 py-4">
          <div className="rounded-xl bg-amber-500/10 p-3.5 dark:bg-amber-400/10">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                <Icon icon={Calendar03Icon} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">
                  {t.admin.chosenTime}
                </p>
                <p className="mt-0.5 text-lg font-semibold text-foreground tabular-nums">
                  {formatDay(request.requestedDate as string, locale)} · {request.requestedTime}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {typeof request.priceCents === "number" ? (
                    <span className="font-semibold text-foreground tabular-nums">
                      {Math.round(request.priceCents / 100)} €
                    </span>
                  ) : null}
                  {request.surcharge ? <StatusPill tone="warning">{t.admin.surcharge}</StatusPill> : null}
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:flex sm:justify-end">
              <Button
                type="button"
                variant="dangerOutline"
                size="lg"
                onClick={() => setDeclineOpen(true)}
                disabled={pending}
                className="w-full sm:w-auto"
              >
                {t.admin.declineRequest}
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={confirm}
                loading={pending}
                className="w-full sm:w-auto"
              >
                {pending ? t.common.working : t.admin.confirmRequest}
              </Button>
            </div>
          </div>
          <Feedback result={feedback} className="mt-3" />
        </div>
      ) : null}

      {hasDetails ? (
        <div id={bodyId} hidden={!open}>
          {open ? (
            <div className="space-y-4 border-t px-4 pt-4 pb-4">
            {/* Client note */}
            {request.note ? (
              <div className="flex items-start gap-2.5 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-foreground/90">
                <Icon icon={Note01Icon} className="mt-0.5 text-muted-foreground" />
                <p className="min-w-0 break-words">“{request.note}”</p>
              </div>
            ) : null}

            {/* Legacy 3-window preferences (only old requests have these) */}
            {request.preferences.length > 0 ? (
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {t.admin.clientPreferences}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {request.preferences.map((preference) => {
                    const active = preference.date === date && windowFilter === preference.window;
                    return (
                      <button
                        key={preference.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => choosePreference(preference.date, preference.window)}
                        className={cn(
                          "min-h-14 rounded-lg px-3 py-2 text-left text-sm ring-1 transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          active
                            ? "bg-primary text-primary-foreground ring-primary"
                            : "bg-card text-foreground ring-foreground/15 hover:bg-muted/60",
                        )}
                      >
                        <span className="block text-xs font-semibold opacity-70">
                          {t.client.choice(preference.rank)}
                        </span>
                        <span className="block font-semibold">{formatDay(preference.date, locale)}</span>
                        <span className="block text-xs opacity-80">{t.windows[preference.window]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {canPropose ? (
              <Collapsible
                open={hasChosenSlot ? proposalControlsOpen : true}
                onOpenChange={setProposalControlsOpen}
              >
                {hasChosenSlot ? (
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="w-full justify-between sm:w-auto sm:justify-center"
                    >
                      <Icon icon={CalendarAdd01Icon} />
                      {t.admin.orProposeAnother}
                      <Icon
                        icon={ArrowDown01Icon}
                        className={cn("transition-transform", proposalControlsOpen && "rotate-180")}
                      />
                    </Button>
                  </CollapsibleTrigger>
                ) : null}

                <CollapsibleContent className={cn(hasChosenSlot && "pt-4")}>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                    <AvailabilityCalendar
                      t={t}
                      locale={locale}
                      appointments={appointments}
                      blockedDates={blockedDates}
                      preferences={request.preferences}
                      selectedDate={date}
                      onPickDate={chooseDate}
                    />

                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DateField
                          label={t.admin.date}
                          value={date}
                          min={addDays(0)}
                          onChange={chooseDate}
                        />
                        <SelectField
                          label={t.admin.timeOfDay}
                          value={windowFilter}
                          onChange={(event) =>
                            setWindowFilter(event.target.value as DayWindow | "all")
                          }
                        >
                          <option value="all">{t.admin.allHours}</option>
                          <option value="Morning">{t.windows.Morning}</option>
                          <option value="Midday">{t.windows.Midday}</option>
                          <option value="Afternoon">{t.windows.Afternoon}</option>
                          <option value="Evening">{t.windows.Evening}</option>
                        </SelectField>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-foreground">{t.admin.pickSlot}</p>
                        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {slots.map(({ hour, taken }) => {
                            const selected = hour === time;
                            return (
                              <button
                                key={hour}
                                type="button"
                                disabled={taken}
                                aria-pressed={selected}
                                onClick={() => setTime(hour)}
                                title={taken ? t.admin.alreadyBooked : t.windows[windowForTime(hour)]}
                                className={cn(
                                  "h-10 rounded-lg text-sm font-semibold tabular-nums transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                                  taken &&
                                    "cursor-not-allowed bg-muted text-muted-foreground/50 line-through",
                                  !taken && selected && "bg-primary text-primary-foreground shadow-xs",
                                  !taken &&
                                    !selected &&
                                    "bg-card text-foreground ring-1 ring-foreground/15 hover:bg-muted/60",
                                )}
                              >
                                {hour}
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-sm bg-card ring-1 ring-foreground/15" />
                            {t.admin.legendOpen}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-sm bg-muted" />
                            {t.admin.legendBooked}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <TextAreaField
                    label={t.admin.messageToClient}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={2}
                    className="mt-4"
                  />

                  {conflict ? (
                    <Feedback result={{ ok: false, error: t.admin.slotTakenShort }} className="mt-3" />
                  ) : null}
                  <Feedback result={feedback && !feedback.ok ? feedback : null} className="mt-3" />

                  <Button
                    type="button"
                    size="lg"
                    onClick={submit}
                    disabled={conflict}
                    loading={pending}
                    className="mt-4 w-full sm:w-auto"
                  >
                    {pending ? t.common.sending : t.admin.proposeAt(formatDay(date, locale), time)}
                  </Button>
                </CollapsibleContent>
              </Collapsible>
            ) : null}

            {!hasChosenSlot && (request.status === "pending" || request.status === "proposed") ? (
              <Button
                type="button"
                variant="dangerOutline"
                size="lg"
                className="w-full sm:w-auto"
                disabled={pending}
                onClick={() => setDeclineOpen(true)}
              >
                {t.admin.declineRequest}
              </Button>
            ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        title={t.admin.declineRequestTitle}
        description={t.admin.declineRequestBody}
        confirmLabel={pending ? t.common.working : t.admin.declineRequest}
        loading={pending}
        onConfirm={decline}
      >
        <TextAreaField
          label={t.admin.declineRequestReason}
          value={declineReason}
          onChange={(event) => setDeclineReason(event.target.value)}
          placeholder={t.admin.declineRequestReasonPlaceholder}
          maxLength={1000}
          rows={3}
        />
      </ConfirmDialog>
    </article>
  );
}

const bannerTone = {
  success: "bg-emerald-500/10 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200",
  info: "bg-sky-500/10 text-sky-800 dark:bg-sky-400/10 dark:text-sky-200",
} as const;

function SummaryBanner({
  tone,
  icon,
  children,
}: {
  tone: keyof typeof bannerTone;
  icon: typeof CheckmarkCircle02Icon;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t px-4 py-3">
      <p className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", bannerTone[tone])}>
        <Icon icon={icon} strokeWidth={2} />
        <span className="min-w-0">{children}</span>
      </p>
    </div>
  );
}

function AvailabilityCalendar({
  t,
  locale,
  appointments,
  blockedDates,
  preferences,
  selectedDate,
  onPickDate,
}: {
  t: Dict;
  locale: string;
  appointments: Appointment[];
  blockedDates: ReadonlySet<string>;
  preferences: Preference[];
  selectedDate: string;
  onPickDate: (date: string) => void;
}) {
  const today = todayIso();
  const [month, setMonth] = useState(() => monthKey(selectedDate || today));
  const cells = monthGrid(month);

  const bookedByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const appointment of appointments) {
      counts.set(appointment.date, (counts.get(appointment.date) ?? 0) + 1);
    }
    return counts;
  }, [appointments]);

  const preferenceRank = new Map(preferences.map((p) => [p.date, p.rank]));

  return (
    <div className="rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground" aria-live="polite">
          {formatMonth(`${month}-01`, locale)}
        </h4>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t.common.previousMonth}
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <Icon icon={ArrowLeft01Icon} />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t.common.nextMonth}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <Icon icon={ArrowRight01Icon} />
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {t.weekdaysMini.map((day) => (
          <div
            key={day}
            className="pb-1 text-center text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {day}
          </div>
        ))}

        {cells.map((cell) => {
          const dayNumber = Number(cell.date.slice(8, 10));

          if (!cell.inMonth) {
            return <div key={cell.date} aria-hidden className="h-10" />;
          }

          const isPast = cell.date < today;
          const blocked = blockedDates.has(cell.date);
          const booked = bookedByDate.get(cell.date) ?? 0;
          const full = booked >= dayCapacity;
          const rank = preferenceRank.get(cell.date);
          const selected = cell.date === selectedDate;
          const disabled = isPast || blocked;
          const load = Math.min(booked / dayCapacity, 1);

          return (
            <button
              key={cell.date}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onPickDate(cell.date)}
              title={
                blocked
                  ? t.admin.off
                  : `${t.admin.bookedOfCapacity(booked, dayCapacity)}${rank ? ` · ${t.admin.clientChoiceN(rank)}` : ""}`
              }
              className={cn(
                "relative flex h-10 flex-col items-center justify-center rounded-lg text-xs tabular-nums transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected
                  ? "bg-primary font-semibold text-primary-foreground"
                  : disabled
                    ? "cursor-not-allowed text-muted-foreground/40"
                    : "bg-card text-foreground ring-1 ring-foreground/10 hover:bg-muted",
                !selected && !disabled && full && "bg-destructive/10 ring-destructive/30",
                rank !== undefined && !selected && "ring-2 ring-foreground/50",
              )}
            >
              <span>{dayNumber}</span>
              {/* Booking-load bar */}
              {!disabled && !selected ? (
                <span className="absolute inset-x-1.5 bottom-1 h-0.5 overflow-hidden rounded-full bg-foreground/10">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      full ? "bg-destructive" : load > 0.6 ? "bg-amber-500" : "bg-emerald-500",
                    )}
                    style={{ width: `${Math.max(load * 100, booked > 0 ? 12 : 0)}%` }}
                  />
                </span>
              ) : null}
              {rank ? (
                <span
                  className={cn(
                    "absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full text-[0.55rem] font-bold ring-1",
                    selected
                      ? "bg-card text-foreground ring-foreground"
                      : "bg-primary text-primary-foreground ring-card",
                  )}
                >
                  {rank}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-full bg-emerald-500" />
          {t.admin.legendOpen}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-full bg-amber-500" />
          {t.admin.legendFilling}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-full bg-destructive" />
          {t.admin.legendFull}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex size-3 items-center justify-center rounded-full bg-primary text-[0.5rem] font-bold text-primary-foreground">
            #
          </span>
          {t.admin.legendClientPick}
        </span>
      </div>
    </div>
  );
}
