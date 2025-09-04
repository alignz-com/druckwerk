"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, IdCard, ShoppingBag } from "lucide-react";

const items = [
  { href: "/omicron", label: "Personal details", Icon: IdCard },
  { href: "/omicron/orders", label: "Orders", Icon: ShoppingBag },
];

export default function OmicronNav() {
  const pathname = usePathname();
  return (
    <nav className="p-3">
      {items.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`group mb-1 flex w-full items-center justify-between rounded-xl border p-3 text-left transition
              ${active ? "border-indigo-600 bg-indigo-50" : "border-transparent hover:bg-slate-50"}`}
          >
            <span className="flex items-center gap-3">
              <Icon className={`size-5 ${active ? "text-indigo-700" : "text-slate-500"}`} />
              <span className={`text-sm ${active ? "font-semibold text-indigo-900" : "text-slate-700"}`}>{label}</span>
            </span>
            <ChevronRight className={`size-4 ${active ? "text-indigo-700" : "text-slate-400"}`} />
          </Link>
        );
      })}
    </nav>
  );
}
