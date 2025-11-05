"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type SortableColumn<TData> = {
  id: string;
  getCanSort?: () => boolean;
  getIsSorted?: () => false | "asc" | "desc";
  toggleSorting?: (desc?: boolean) => void;
};

export type DataTableColumnHeaderProps<TData> = {
  column: SortableColumn<TData>;
  title: string;
  align?: "left" | "right";
};

export function DataTableColumnHeader<TData>({ column, title, align = "left" }: DataTableColumnHeaderProps<TData>) {
  const canSort = column.getCanSort?.() ?? Boolean(column.toggleSorting);

  if (!canSort) {
    return (
      <span className={cn("text-xs font-semibold uppercase tracking-wide text-slate-500", align === "right" && "text-right")}
        >
        {title}
      </span>
    );
  }

  const isSorted = column.getIsSorted?.() ?? false;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "-ml-2 h-8 px-2 text-xs font-semibold uppercase tracking-wide text-slate-600",
        align === "right" && "ml-auto flex-row-reverse",
        "hover:bg-transparent hover:text-slate-900",
      )}
      onClick={() => column.toggleSorting?.(isSorted === "asc")}
    >
      <span>{title}</span>
      {isSorted === "asc" ? <ArrowUp className="ml-2 h-3.5 w-3.5" /> : null}
      {isSorted === "desc" ? <ArrowDown className="ml-2 h-3.5 w-3.5" /> : null}
      {isSorted === false ? <ArrowUpDown className="ml-2 h-3.5 w-3.5" /> : null}
    </Button>
  );
}
