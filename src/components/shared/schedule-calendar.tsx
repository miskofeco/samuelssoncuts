"use client";

import { enUS, sk } from "date-fns/locale";
import type { ReactNode } from "react";
import type { DayButtonProps, Matcher, Modifiers } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import { isoToLocalDate, localDateToIso } from "@/components/shared/date-field";
import { useLang } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

export const DAY_PICKER_LOCALES = { sk, en: enUS } as const;

export type ScheduleDayInfo = { iso: string; date: Date; modifiers: Modifiers };
export type ScheduleDayRender = (info: ScheduleDayInfo) => ReactNode;
export type ScheduleDayClassName = (info: ScheduleDayInfo) => string | undefined;

/**
 * Large-cell month calendar built on the shadcn `Calendar` (react-day-picker).
 * Used where a day needs to carry more than its number: the client booking
 * picker (availability, blocked days) and the admin month overview (event
 * dots, blocked days). Values cross the boundary as "yyyy-mm-dd" strings.
 *
 * Callers describe day states through `modifiers` (react-day-picker matchers)
 * and paint them through `renderDay` / `modifiersClassNames`; the calendar
 * owns the frame, the locale, Monday-first weeks and keyboard navigation.
 */
export function ScheduleCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  startMonth,
  endMonth,
  disabled,
  modifiers,
  modifiersClassNames,
  renderDay,
  dayClassName,
  hideNavigation = false,
  /** "fluid" stretches cells to fill the container (admin overview). */
  size = "compact",
  className,
}: {
  /** Controlled month as "yyyy-mm". */
  month?: string;
  onMonthChange?: (month: string) => void;
  /** Selected day as "yyyy-mm-dd". */
  selected?: string | null;
  onSelect?: (iso: string) => void;
  /** Inclusive month bounds as "yyyy-mm". */
  startMonth?: string;
  endMonth?: string;
  disabled?: Matcher | Matcher[];
  modifiers?: Record<string, Matcher | Matcher[] | undefined>;
  modifiersClassNames?: Record<string, string>;
  renderDay?: ScheduleDayRender;
  /** Extra classes for the day button (merged last, so they win). */
  dayClassName?: ScheduleDayClassName;
  hideNavigation?: boolean;
  size?: "compact" | "fluid";
  className?: string;
}) {
  const lang = useLang();
  const selectedDate = selected ? isoToLocalDate(selected) : undefined;
  const monthDate = month ? isoToLocalDate(`${month}-01`) : undefined;
  const fluid = size === "fluid";

  return (
    <Calendar
      mode="single"
      required={false}
      locale={DAY_PICKER_LOCALES[lang]}
      weekStartsOn={1}
      showOutsideDays
      hideNavigation={hideNavigation}
      month={monthDate}
      onMonthChange={(next) => onMonthChange?.(localDateToIso(next).slice(0, 7))}
      startMonth={startMonth ? isoToLocalDate(`${startMonth}-01`) : undefined}
      endMonth={endMonth ? isoToLocalDate(`${endMonth}-01`) : undefined}
      selected={selectedDate}
      onSelect={(date) => {
        if (date) onSelect?.(localDateToIso(date));
      }}
      disabled={disabled}
      modifiers={modifiers}
      modifiersClassNames={modifiersClassNames}
      className={cn(
        "w-full bg-transparent p-0",
        fluid ? "[--cell-size:auto]" : "[--cell-size:--spacing(11)] sm:[--cell-size:--spacing(12)]",
        className,
      )}
      classNames={{
        root: "w-full",
        months: "relative flex w-full flex-col",
        month: "flex w-full flex-col gap-3",
        month_caption: cn(
          "flex h-9 w-full items-center",
          hideNavigation ? "justify-start" : "justify-center px-9",
        ),
        caption_label: "text-base font-semibold capitalize select-none",
        nav: "absolute inset-x-0 top-0 flex h-9 items-center justify-between",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "flex-1 pb-1 text-center text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase select-none",
        week: "mt-1 flex w-full gap-1",
        day: cn(
          "group/day relative flex-1 select-none p-0 text-center",
          fluid ? "min-h-[4.75rem]" : "aspect-square",
        ),
        today: "",
        outside: "",
        disabled: "",
        hidden: "invisible",
      }}
      components={{
        DayButton: (props) => (
          <ScheduleDayButton {...props} fluid={fluid} renderDay={renderDay} dayClassName={dayClassName} />
        ),
      }}
    />
  );
}

function ScheduleDayButton({
  day,
  modifiers,
  className,
  fluid,
  renderDay,
  dayClassName,
  ...props
}: DayButtonProps & {
  fluid: boolean;
  renderDay?: ScheduleDayRender;
  dayClassName?: ScheduleDayClassName;
}) {
  const info: ScheduleDayInfo = { iso: localDateToIso(day.date), date: day.date, modifiers };
  const extra = renderDay?.(info);

  return (
    <button
      type="button"
      data-selected={modifiers.selected || undefined}
      data-today={modifiers.today || undefined}
      data-outside={modifiers.outside || undefined}
      className={cn(
        "flex size-full flex-col rounded-lg border bg-card text-foreground transition outline-none",
        fluid ? "items-start justify-start p-1.5 text-left" : "items-center justify-center gap-0.5",
        "hover:not-disabled:border-foreground/60 active:not-disabled:scale-[0.97]",
        "focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted/60 disabled:text-muted-foreground",
        modifiers.outside && !modifiers.selected && "border-border/60 text-muted-foreground",
        modifiers.today && "ring-2 ring-inset ring-foreground",
        modifiers.selected &&
          "border-primary bg-primary text-primary-foreground hover:not-disabled:border-primary [&_[data-muted]]:text-primary-foreground/80",
        className,
        dayClassName?.(info),
      )}
      {...props}
    >
      <span className="text-sm font-semibold tabular-nums leading-none">{day.date.getDate()}</span>
      {extra ? <span className={cn("flex", fluid ? "mt-1.5 w-full flex-1" : "mt-0.5")}>{extra}</span> : null}
    </button>
  );
}
