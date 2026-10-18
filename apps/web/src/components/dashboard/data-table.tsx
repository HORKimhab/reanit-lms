import { cn } from "@reanit/ui/lib/utils";
import type * as React from "react";

/** A table column: its heading and whether it holds numbers, which align right. */
type Column = { label: string; isNumeric?: boolean };

const CELL = "px-4 py-3";
const NUMERIC = "text-right tabular-nums";

/**
 * The dashboard's bordered, horizontally scrollable table.
 *
 * @param props - Component props.
 * @param props.caption - Accessible name of the table, hidden visually.
 * @param props.columns - Column headings, in order.
 * @param props.children - The body rows: `<tr>` with a `RowHeader` then one `Cell` per remaining column.
 * @returns The table.
 */
export function DataTable({ caption, columns, children }: { caption: string; columns: Column[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            {columns.map(({ label, isNumeric }) => (
              <th key={label} scope="col" className={cn(CELL, "font-medium", isNumeric && NUMERIC)}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

/**
 * The first cell of a row, which names the row.
 *
 * @param props - Component props.
 * @param props.children - The row's name, such as a course title.
 * @returns A row header cell.
 */
export function RowHeader({ children }: { children: React.ReactNode }) {
  return (
    <th scope="row" className={cn(CELL, "text-left font-medium")}>
      {children}
    </th>
  );
}

/**
 * A body cell.
 *
 * @param props - Component props.
 * @param props.isNumeric - Aligns right with even-width digits.
 * @param props.children - The cell's content.
 * @returns A table cell.
 */
export function Cell({ isNumeric, children }: { isNumeric?: boolean; children: React.ReactNode }) {
  return <td className={cn(CELL, isNumeric && NUMERIC)}>{children}</td>;
}

/**
 * Shown instead of a dashboard table when it has no rows.
 *
 * @param props - Component props.
 * @param props.title - What is missing, such as "No courses yet".
 * @param props.text - Where the rows will come from.
 * @returns A dashed box with the title and text.
 */
export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
