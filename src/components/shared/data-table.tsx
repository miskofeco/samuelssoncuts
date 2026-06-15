import type { ReactNode } from "react";

import { cn } from "@/lib/classnames";

export type Column<T> = {
  key: string;
  header: ReactNode;
  /** Cell renderer. */
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hide on small screens. */
  hideOnMobile?: boolean;
  align?: "left" | "right" | "center";
};

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  className?: string;
}) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/10">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400",
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
                  "cursor-pointer transition hover:bg-stone-50 dark:hover:bg-stone-800/50",
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-3 py-3 text-stone-700 dark:text-stone-300",
                    alignClass[column.align ?? "left"],
                    column.hideOnMobile && "hidden sm:table-cell",
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
