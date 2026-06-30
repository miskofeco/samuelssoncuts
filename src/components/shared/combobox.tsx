"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/classnames";

export type ComboboxOption = {
  value: string;
  label: string;
  // When set, the option is shown muted, can't be chosen, and is skipped by
  // keyboard navigation. Used to grey out time slots that are taken / don't fit.
  disabled?: boolean;
  // Optional trailing hint (e.g. "taken") rendered after the label.
  hint?: string;
};

const controlClass =
  "w-full rounded-md border border-black/10 bg-white px-3 text-sm text-black outline-none transition placeholder:text-stone-400 focus:border-black focus:ring-2 focus:ring-black/10 dark:border-white/15 dark:bg-stone-900 dark:text-white dark:placeholder:text-stone-500 dark:focus:border-white dark:focus:ring-white/15";

// A text input that filters a dropdown of options as you type — a searchable
// alternative to <select>. Controlled via `value` / `onChange`.
export function Combobox({
  label,
  options,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const listId = useId();
  const selectedLabel = options.find((option) => option.value === value)?.label ?? "";

  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLLabelElement>(null);

  // When the dropdown is closed, the input always shows the selected label.
  // While open, it shows what the user is typing and filters by it.
  const trimmed = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!open || query === selectedLabel || trimmed === "") return options;
    return options.filter((option) => option.label.toLowerCase().includes(trimmed));
  }, [open, query, selectedLabel, trimmed, options]);

  // Close when clicking outside; revert the text to the real selection.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selectedLabel);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, selectedLabel]);

  function choose(option: ComboboxOption) {
    if (option.disabled) return;
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  // Next selectable index in `direction` (+1/-1), skipping disabled options.
  function nextEnabled(from: number, direction: 1 | -1) {
    let index = from;
    for (let step = 0; step < filtered.length; step += 1) {
      index += direction;
      if (index < 0 || index >= filtered.length) return from;
      if (!filtered[index]?.disabled) return index;
    }
    return from;
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((index) => nextEnabled(index, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => nextEnabled(index, -1));
    } else if (event.key === "Enter") {
      if (open && filtered[activeIndex] && !filtered[activeIndex].disabled) {
        event.preventDefault();
        choose(filtered[activeIndex]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery(selectedLabel);
    }
  }

  return (
    <label className={cn("block", className)} ref={rootRef}>
      <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{label}</span>
      <div className="relative mt-2">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn("h-11", controlClass)}
        />
        {/* Chevron */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>

        {open ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-black/10 bg-white py-1 shadow-lg dark:border-white/15 dark:bg-stone-900"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-stone-400 dark:text-stone-500">
                No matches
              </li>
            ) : (
              filtered.map((option, index) => {
                const active = index === activeIndex;
                const selected = option.value === value;
                const disabled = option.disabled ?? false;
                return (
                  <li key={option.value} role="option" aria-selected={selected} aria-disabled={disabled}>
                    <button
                      type="button"
                      disabled={disabled}
                      // onMouseDown (not onClick) so it fires before the input blur.
                      onMouseDown={(event) => {
                        event.preventDefault();
                        choose(option);
                      }}
                      onMouseEnter={() => {
                        if (!disabled) setActiveIndex(index);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition",
                        disabled
                          ? "cursor-not-allowed text-stone-300 dark:text-stone-600"
                          : active
                            ? "bg-stone-100 text-black dark:bg-stone-800 dark:text-white"
                            : "text-stone-700 dark:text-stone-300",
                        selected && !disabled && "font-semibold",
                      )}
                    >
                      <span className="truncate">{option.label}</span>
                      {option.hint ? (
                        <span className={cn("shrink-0 text-xs", disabled ? "" : "text-stone-400 dark:text-stone-500")}>
                          {option.hint}
                        </span>
                      ) : selected ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>
    </label>
  );
}
