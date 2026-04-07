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
  shipTo: string | null;
};

type Props = {
  confirmations: ConfirmationRow[];
  searchPlaceholder: string;
  columns: {
    number: string;
    created: string;
    orders: string;
    shipTo: string;
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
        (c.note ?? "").toLowerCase().includes(q) ||
        (c.shipTo ?? "").toLowerCase().includes(q),
    );
  }, [confirmations, q]);

  return (
    <>
      <div className="relative w-full max-w-sm">
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
              <TableHead className="w-44 whitespace-nowrap">{columns.number}</TableHead>
              <TableHead className="w-32">{columns.created}</TableHead>
              <TableHead className="w-20">{columns.orders}</TableHead>
              <TableHead>{columns.shipTo}</TableHead>
              <TableHead>{columns.note}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className={dataTableRowClass}>
                <TableCell colSpan={5} className="text-center text-sm text-slate-500">
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
                  <TableCell className="text-slate-600">{c.shipTo || "–"}</TableCell>
                  <TableCell className="truncate text-slate-500">{c.note || "–"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
