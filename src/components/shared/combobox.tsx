"use client";

import { UnfoldMoreIcon } from "@hugeicons/core-free-icons";
import { useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/components/shared/icon";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/classnames";

export type ComboboxOption = {
  value: string;
  label: string;
  /** Shown muted, not selectable, skipped by keyboard navigation. */
  disabled?: boolean;
  /** Optional trailing hint (e.g. "taken") rendered after the label. */
  hint?: string;
};

/**
 * Searchable single-select built on Popover + cmdk. The trigger is a real
 * button (no on-screen keyboard until the list opens), the list is portaled so
 * it is never clipped by modal scroll containers, and cmdk supplies type-ahead
 * filtering plus roving keyboard focus.
 *
 * The popover is `modal` so it owns the scroll lock while open: when the
 * combobox lives inside a Dialog/Drawer, the dialog's own scroll lock would
 * otherwise swallow wheel/touch scrolling in the portaled list. The list opens
 * with the current value highlighted and scrolled into view (not the first
 * option), so long lists such as time slots start where the user is.
 */
export function Combobox({
  label,
  options,
  value,
  onChange,
  placeholder,
  className,
  /** Hide the search input for short fixed lists (e.g. time slots). */
  searchable = true,
  /** Accessible name when the visible label repeats across rows (e.g. per weekday). */
  ariaLabel,
  /** Validation error shown under the trigger; marks it `aria-invalid`. */
  error,
}: {
  label: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  searchable?: boolean;
  ariaLabel?: string;
  error?: string | null;
}) {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  // cmdk's highlighted row. Seeded from the current value on every open so
  // keyboard navigation starts at the selection instead of the first option.
  const [highlighted, setHighlighted] = useState(value);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    // Wait for the portal + list to mount, then centre the selected row.
    const frame = requestAnimationFrame(() => {
      const row = listRef.current?.querySelector<HTMLElement>('[data-checked="true"]');
      row?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function handleOpenChange(next: boolean) {
    if (next) setHighlighted(value);
    setOpen(next);
  }

  return (
    <Field data-invalid={error ? true : undefined} className={cn("gap-1.5", className)}>
      <FieldLabel htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </FieldLabel>
      <Popover open={open} onOpenChange={handleOpenChange} modal>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="h-10 w-full justify-between bg-card px-3 font-normal aria-expanded:bg-card"
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected?.label ?? placeholder ?? ""}
            </span>
            <Icon icon={UnfoldMoreIcon} className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-56 p-0"
          onOpenAutoFocus={(event) => {
            // Keep focus on the button for non-searchable lists so phones do
            // not raise a keyboard; cmdk still handles arrow keys.
            if (!searchable) event.preventDefault();
          }}
        >
          <Command shouldFilter={searchable} value={highlighted} onValueChange={setHighlighted}>
            {searchable ? <CommandInput placeholder={placeholder ?? label} /> : null}
            <CommandList
              ref={listRef}
              className="max-h-64 overscroll-contain"
            >
              <CommandEmpty>{t.common.noMatches}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={[option.label]}
                    disabled={option.disabled}
                    data-checked={option.value === value}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className="min-h-10"
                  >
                    <span className={cn("truncate", option.value === value && "font-semibold")}>{option.label}</span>
                    {option.hint ? (
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{option.hint}</span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error ? (
        <FieldError id={`${id}-error`} className="text-xs font-medium">
          {error}
        </FieldError>
      ) : null}
    </Field>
  );
}
