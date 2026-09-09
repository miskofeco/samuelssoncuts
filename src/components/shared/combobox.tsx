"use client";

import { Popover } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

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

const controlClass =
  "w-full rounded-md border border-black/10 bg-white px-3 pr-9 text-sm text-black outline-none transition placeholder:text-stone-500 focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/15 dark:bg-stone-900 dark:text-white dark:placeholder:text-stone-400 dark:focus:border-white dark:focus:ring-white/15";

/**
 * Searchable single-select. The input is the combobox; the option list is a
 * Radix Popover so it is portaled (never clipped by modal scroll containers),
 * dismisses on outside interaction, and, when nested in a Modal, owns Escape
 * before the dialog does. ARIA: `aria-activedescendant` points at the highlighted
 * option so screen readers announce it.
 */
export function Combobox({
  label,
  options,
  value,
  onChange,
  placeholder,
  className,
  /** Disable the on-screen keyboard for short fixed lists (e.g. time slots). */
  searchable = true,
}: {
  label: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  searchable?: boolean;
}) {
  const t = useT();
  const baseId = useId();
  const listId = `${baseId}-list`;
  const selectedLabel = options.find((option) => option.value === value)?.label ?? "";

  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the visible text in sync when the selection changes from outside.
  const [lastSelected, setLastSelected] = useState(selectedLabel);
  if (selectedLabel !== lastSelected) {
    setLastSelected(selectedLabel);
    setQuery(selectedLabel);
  }

  const trimmed = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!searchable || !open || query === selectedLabel || trimmed === "") return options;
    return options.filter((option) => option.label.toLowerCase().includes(trimmed));
  }, [searchable, open, query, selectedLabel, trimmed, options]);

  const clampedIndex = Math.min(activeIndex, Math.max(filtered.length - 1, 0));

  // Keep the highlighted option in view while navigating with the keyboard.
  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest" });
  }, [open, clampedIndex]);

  function optionId(index: number) {
    return `${baseId}-option-${index}`;
  }

  function close(revert = true) {
    setOpen(false);
    if (revert) setQuery(selectedLabel);
  }

  function choose(option: ComboboxOption) {
    if (option.disabled) return;
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  function nextEnabled(from: number, direction: 1 | -1) {
    let index = from;
    for (let step = 0; step < filtered.length; step += 1) {
      index += direction;
      if (index < 0 || index >= filtered.length) return from;
      if (!filtered[index]?.disabled) return index;
    }
    return from;
  }

  function openAtSelection() {
    const selectedIndex = filtered.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : nextEnabled(-1, 1));
    setOpen(true);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) return openAtSelection();
      setActiveIndex(nextEnabled(clampedIndex, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return openAtSelection();
      setActiveIndex(nextEnabled(clampedIndex, -1));
    } else if (event.key === "Enter") {
      const option = filtered[clampedIndex];
      if (open && option && !option.disabled) {
        event.preventDefault();
        choose(option);
      }
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      close();
    }
  }

  return (
    <div className={cn("block", className)}>
      <label htmlFor={`${baseId}-input`} className="text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}
      </label>
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <Popover.Anchor asChild>
          <div className="relative mt-2">
            <input
              ref={inputRef}
              id={`${baseId}-input`}
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete={searchable ? "list" : "none"}
              aria-activedescendant={open && filtered[clampedIndex] ? optionId(clampedIndex) : undefined}
              autoComplete="off"
              inputMode={searchable ? "text" : "none"}
              readOnly={!searchable}
              value={query}
              placeholder={placeholder}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
                if (!open) setOpen(true);
              }}
              onClick={() => {
                if (!open) openAtSelection();
              }}
              onFocus={() => {
                if (!open) openAtSelection();
              }}
              onKeyDown={onKeyDown}
              className={cn("h-11", !searchable && "cursor-pointer", controlClass)}
            />
            <ChevronDown
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-stone-500 transition-transform",
                open && "rotate-180",
              )}
            />
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              // Clicking the input itself must not close the list.
              if (event.target instanceof Node && inputRef.current?.contains(event.target)) {
                event.preventDefault();
              }
            }}
            className="ss-popover z-[70] w-[var(--radix-popover-trigger-width)] rounded-md border border-black/10 bg-white py-1 shadow-lg outline-none dark:border-white/15 dark:bg-stone-900"
          >
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={label}
              className="max-h-60 overflow-y-auto overscroll-contain"
            >
              {filtered.length === 0 ? (
                <li role="presentation" className="px-3 py-2 text-sm text-stone-500 dark:text-stone-400">
                  {t.common.noMatches}
                </li>
              ) : (
                filtered.map((option, index) => {
                  const active = index === clampedIndex;
                  const selected = option.value === value;
                  const disabled = option.disabled ?? false;
                  return (
                    <li
                      key={option.value}
                      id={optionId(index)}
                      role="option"
                      aria-selected={selected}
                      aria-disabled={disabled || undefined}
                      data-active={active ? "true" : undefined}
                      onPointerDown={(event) => {
                        // Select on pointer down so the input never blurs first.
                        event.preventDefault();
                        choose(option);
                      }}
                      onPointerMove={() => {
                        if (!disabled && !active) setActiveIndex(index);
                      }}
                      className={cn(
                        "flex min-h-10 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm transition",
                        disabled
                          ? "cursor-not-allowed text-stone-400 dark:text-stone-600"
                          : active
                            ? "bg-stone-100 text-black dark:bg-stone-800 dark:text-white"
                            : "text-stone-700 dark:text-stone-300",
                        selected && !disabled && "font-semibold",
                      )}
                    >
                      <span className="truncate">{option.label}</span>
                      {option.hint ? (
                        <span className="shrink-0 text-xs text-stone-500 dark:text-stone-400">{option.hint}</span>
                      ) : selected ? (
                        <Check className="size-4 shrink-0" aria-hidden />
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
