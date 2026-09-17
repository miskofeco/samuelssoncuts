import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
                  className="w-full rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted/70"
                >
                  {mobileCard(row)}
                </button>
              ) : (
                <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">{mobileCard(row)}</div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <div className={cn("-mx-1 rounded-lg", mobileCard && "hidden sm:block")}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  scope="col"
                  className={cn(
                    "h-10 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
                    alignClass[column.align ?? "left"],
                    column.hideOnMobile && "hidden sm:table-cell",
                    column.className,
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && "cursor-pointer focus-within:bg-muted/50")}
              >
                {columns.map((column, index) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      "px-3 py-3 whitespace-normal text-foreground/90",
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
                          className="absolute inset-0 rounded-md opacity-0 outline-none focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                        />
                        {column.cell(row)}
                      </>
                    ) : (
                      column.cell(row)
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
