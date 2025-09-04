import type { ReactNode } from "react";
import OmicronShell from "@/components/layout/OmicronShell";
import { Separator } from "@/components/ui/separator";
import { ChevronRight, IdCard, ShoppingBag } from "lucide-react";

const navItems = [
  { key: "details", label: "Personal details", href: "/omicron", icon: IdCard },
  { key: "orders", label: "Orders", href: "/omicron/orders", icon: ShoppingBag },
] as const;

export default function OmicronRouteLayout({ children }: { children: ReactNode }) {
  // Sidebar-Content (Server safe – nur statisches JSX)
  const sidebar = (
    <nav className="p-3">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = typeof window === "undefined" ? false : window.location.pathname === href;
        // Server kann active nicht wissen – du kannst später ein Client-Nav draus machen.
        return (
          <a
            key={href}
            href={href}
            className={`group mb-1 flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
              active ? "border-indigo-600 bg-indigo-50" : "border-transparent hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center gap-3">
              <Icon className={`size-5 ${active ? "text-indigo-700" : "text-slate-500"}`} />
              <span className={`text-sm ${active ? "font-semibold text-indigo-900" : "text-slate-700"}`}>{label}</span>
            </span>
            <ChevronRight className={`size-4 ${active ? "text-indigo-700" : "text-slate-400"}`} />
          </a>
        );
      })}
    </nav>
  );

  // Header (du kannst hier auch ein Breadcrumb etc. reinmachen)
  const header = (
    <div className="sticky top-0 z-10 -mx-5 mb-2 bg-muted/20 px-5 pb-2 pt-4 md:static md:mx-0 md:px-0 md:pt-0">
      {/* Leer – die Page kann ihren eigenen Header rendern */}
      <Separator className="hidden md:block" />
    </div>
  );

  return (
    <OmicronShell sidebar={sidebar} header={header}>
      {children}
    </OmicronShell>
  );
}
