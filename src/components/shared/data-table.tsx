import type { ReactNode } from "react";

import { cn } from "@/lib/classnames";

export type Column<T> = {
  key: string;
  header: ReactNode;
  /** Cell renderer. */
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hide on small screens (the row's `mobileCard` should surface the value instead). */
  hideOnMobile?: boolean;
  align?: "left" | "right" | "center";
};

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

/**
 * Semantic data table. Rows stay real `<tr>`s; a clickable row gets a keyboard
 * path through a full-cell button in the first column instead of an invalid
 * `role="button"` on the row. On phones, when `mobileCard` is provided, the
 * table is replaced by a card list so hidden columns are not lost.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowLabel,
  mobileCard,
  empty,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Accessible name for the row action (e.g. "Open client Jane"). */
  rowLabel?: (row: T) => string;
  /** Card renderer used below the `sm` breakpoint. */
  mobileCard?: (row: T) => ReactNode;
  empty?: ReactNode;
  className?: string;
}) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className={className}>
      {mobileCard ? (
        <ul className="space-y-2 sm:hidden">
          {rows.map((row) => (
            <li key={rowKey(row)}>
              {onRowClick ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  aria-label={rowLabel?.(row)}
                  className="w-full rounded-xl border border-black/10 bg-white p-4 text-left transition hover:border-black/20 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:border-white/10 dark:bg-stone-900 dark:hover:bg-stone-800/60 dark:focus-visible:ring-white"
                >
                  {mobileCard(row)}
                </button>
              ) : (
                <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-stone-900">
                  {mobileCard(row)}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <div className={cn("overflow-x-auto", mobileCard && "hidden sm:block")}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-3 py-2.5 text-xs font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400",
                    alignClass[column.align ?? "left"],
                    column.hideOnMobile && "hidden sm:table-cell",
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-black/5 last:border-0 dark:border-white/5",
                  onRowClick &&
                    "cursor-pointer transition hover:bg-stone-50 focus-within:bg-stone-50 dark:hover:bg-stone-800/50 dark:focus-within:bg-stone-800/50",
                )}
              >
                {columns.map((column, index) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-3 py-3 text-stone-700 dark:text-stone-300",
                      alignClass[column.align ?? "left"],
                      column.hideOnMobile && "hidden sm:table-cell",
                      onRowClick && index === 0 && "relative",
                    )}
                  >
                    {onRowClick && index === 0 ? (
                      <>
                        {/* Keyboard path: an invisible full-cell button carrying the row's name. */}
                        <button
                          type="button"
                          aria-label={rowLabel?.(row)}
                          onClick={(event) => {
                            event.stopPropagation();
                            onRowClick(row);
                          }}
                          className="absolute inset-0 rounded-md opacity-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset dark:focus-visible:ring-white"
                        />
                        {column.cell(row)}
                      </>
                    ) : (
                      column.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
