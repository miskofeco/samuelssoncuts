import { cn } from "@/lib/classnames";

type Option<T extends string> = {
  label: string;
  value: T;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="grid rounded-lg border border-black/10 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-stone-900"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-10 rounded-md px-4 text-sm font-semibold transition",
            value === option.value
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
