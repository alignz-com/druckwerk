"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Layers, PlusCircle, ShieldCheck, Type, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  orders: ClipboardList,
  "new-order": PlusCircle,
  "admin-brands": ShieldCheck,
  "admin-templates": Layers,
  "admin-fonts": Type,
};

export type NavItem = {
  href: string;
  label: string;
  icon?: keyof typeof ICONS;
};

export type NavGroup = {
  title?: string;
  items: NavItem[];
};

type Props = {
  groups: NavGroup[];
  className?: string;
  collapsed?: boolean;
};

export function SidebarNav({ groups, className, collapsed = false }: Props) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-5", className)}>
      {groups.map((group, idx) => (
        <div key={group.title ?? `group-${idx}`} className="space-y-2">
          {group.title ? (
            <div
              className={cn(
                "px-1 text-xs font-semibold uppercase tracking-wide text-slate-400",
                collapsed && "sr-only",
              )}
            >
              {group.title}
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            {group.items.map(({ href, label, icon }) => {
              const active = pathname === href;
              const IconComponent = icon ? ICONS[icon] : undefined;

              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center rounded-xl py-2 text-sm transition",
                    collapsed ? "justify-center px-2" : "gap-3 px-3",
                    active ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-100",
                  )}
                  title={collapsed ? label : undefined}
                >
                  {IconComponent ? <IconComponent className="size-5 shrink-0" /> : null}
                  <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
