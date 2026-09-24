"use client";

import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { enUS, sk } from "react-day-picker/locale";
import { useId, useState } from "react";

import { Icon } from "@/components/shared/icon";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { localeFor } from "@/i18n/config";
import { useLang } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

const DAY_PICKER_LOCALE = { sk, en: enUS } as const;

/** "yyyy-mm-dd" → local Date at midnight (no UTC shift). */
export function isoToLocalDate(iso: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return undefined;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Local Date → "yyyy-mm-dd" (no UTC shift). */
export function localDateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Date picker with the same value contract as `<input type="date">`
 * ("yyyy-mm-dd" strings, `min`/`max` as ISO dates) but rendered with the
 * shadcn Calendar in a popover, so the picker looks identical across browsers
 * and follows the app theme. Weeks start on Monday; month/day names follow
 * the active language. The popover is `modal` so it scrolls and dismisses
 * correctly inside dialogs and phone drawers.
 */
export function DateField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
  error,
  placeholder,
  className,
  id: idProp,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  hint?: string;
  error?: string | null;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const lang = useLang();
  const autoId = useId();
  const id = idProp ?? autoId;
  const [open, setOpen] = useState(false);

  const selected = isoToLocalDate(value);
  const minDate = min ? isoToLocalDate(min) : undefined;
  const maxDate = max ? isoToLocalDate(max) : undefined;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const display = selected
    ? new Intl.DateTimeFormat(localeFor(lang), {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(selected)
    : placeholder ?? "";

  return (
    <Field data-invalid={error ? true : undefined} className={cn("gap-1.5", className)}>
      <FieldLabel htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </FieldLabel>
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-expanded={open}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className="h-10 w-full justify-between bg-card px-3 font-normal aria-expanded:bg-card"
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>{display}</span>
            <Icon icon={Calendar03Icon} className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            locale={DAY_PICKER_LOCALE[lang]}
            weekStartsOn={1}
            selected={selected}
            defaultMonth={selected ?? minDate}
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            onSelect={(date) => {
              if (!date) return;
              onChange(localDateToIso(date));
              setOpen(false);
            }}
            className="[--cell-size:--spacing(9)]"
          />
        </PopoverContent>
      </Popover>
      {error ? (
        <FieldError id={`${id}-error`} className="text-xs font-medium">
          {error}
        </FieldError>
      ) : hint ? (
        <FieldDescription id={`${id}-hint`} className="text-xs">
          {hint}
        </FieldDescription>
      ) : null}
    </Field>
  );
}
