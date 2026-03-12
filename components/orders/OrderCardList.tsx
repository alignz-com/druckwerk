"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OrderCardRow, type OrderCardData } from "./OrderCardRow";

type Props = {
  orders: OrderCardData[];
  showBrand: boolean;
  searchPlaceholder: string;
  emptyState: string;
  noResults: string;
};

export function OrderCardList({ orders, showBrand, searchPlaceholder, emptyState, noResults }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      o.referenceCode.toLowerCase().includes(q) ||
      (o.requesterName?.toLowerCase().includes(q) ?? false) ||
      (o.brandName?.toLowerCase().includes(q) ?? false) ||
      (o.templateLabel?.toLowerCase().includes(q) ?? false)
    );
  }, [orders, search]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>

      {/* List */}
      {orders.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">{emptyState}</p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">{noResults}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => (
            <OrderCardRow key={order.id} order={order} showBrand={showBrand} />
          ))}
        </div>
      )}
    </div>
  );
}
