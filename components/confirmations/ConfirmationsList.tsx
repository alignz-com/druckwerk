"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { dataTableContainerClass, dataTableHeaderClass, dataTableRowClass } from "@/components/admin/shared/data-table-styles";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type ConfirmationRow = {
  id: string;
  number: string;
  createdAtLabel: string;
  createdAtValue: number;
  orderCount: number;
  note: string | null;
  deliveryNoteUrl: string | null;
};

type Props = {
  confirmations: ConfirmationRow[];
  searchPlaceholder: string;
  columns: {
    number: string;
    created: string;
    orders: string;
    note: string;
  };
  empty: string;
  noResults: string;
};

export function ConfirmationsList({ confirmations, searchPlaceholder, columns, empty, noResults }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return confirmations;
    return confirmations.filter(
      (c) =>
        c.number.toLowerCase().includes(q) ||
        (c.note ?? "").toLowerCase().includes(q),
    );
  }, [confirmations, q]);

  return (
    <div className="space-y-6">
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>

      <div className={dataTableContainerClass}>
        <Table>
          <TableHeader className={dataTableHeaderClass}>
            <TableRow>
              <TableHead className="w-52 whitespace-nowrap">{columns.number}</TableHead>
              <TableHead>{columns.created}</TableHead>
              <TableHead className="w-28">{columns.orders}</TableHead>
              <TableHead>{columns.note}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className={dataTableRowClass}>
                <TableCell colSpan={4} className="text-center text-sm text-slate-500">
                  {confirmations.length === 0 ? empty : noResults}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className={`${dataTableRowClass} cursor-pointer`}
                  onClick={() => router.push(`/confirmations/${c.id}`)}
                >
                  <TableCell className="whitespace-nowrap font-medium text-slate-900">
                    {c.number}
                  </TableCell>
                  <TableCell>{c.createdAtLabel}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.orderCount}</Badge>
                  </TableCell>
                  <TableCell className="truncate text-slate-600">{c.note || "–"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
