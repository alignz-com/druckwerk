"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Layers, PlusCircle, ShieldCheck, Type, Users, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  orders: ClipboardList,
  "new-order": PlusCircle,
  "admin-brands": ShieldCheck,
  "admin-users": Users,
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
  const groupSpacing = collapsed ? "space-y-4" : "space-y-4";
  const itemsGap = collapsed ? "gap-4" : "gap-4";

  return (
    <nav className={cn("flex flex-col gap-4", className)}>
      {groups.map((group, idx) => (
        <div
          key={group.title ?? `group-${idx}`}
          className={cn(
            groupSpacing,
            idx > 0 && "border-t border-slate-200 pt-3",
            idx > 0 && !collapsed && "mt-4",
            idx > 0 && collapsed && "mt-3",
          )}
        >
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
          <div className={cn("flex flex-col", itemsGap)}>
            {group.items.map(({ href, label, icon }) => {
              const active = pathname === href;
              const IconComponent = icon ? ICONS[icon] : undefined;
              const linkClasses = cn(
                "relative flex items-center text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                collapsed
                  ? "mx-auto h-11 w-11 justify-center rounded-full p-0"
                  : "gap-3 justify-start rounded-xl px-3 py-2",
                active
                  ? "bg-slate-900 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100",
              );

              return (
                <div
                  key={href}
                  className="group relative"
                >
                  <Link
                    href={href}
                    className={linkClasses}
                    aria-label={collapsed ? label : undefined}
                    title={label}
                  >
                    {IconComponent ? (
                      <IconComponent className="size-5 shrink-0" />
                    ) : null}
                    {!collapsed ? <span className="truncate">{label}</span> : null}
                  </Link>
                  {collapsed ? (
                    <span
                      role="tooltip"
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none absolute left-full top-1/2 z-10 ml-3 -translate-y-1/2 translate-x-2 transform rounded-xl bg-slate-900 px-3 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition",
                        "group-hover:translate-x-0 group-hover:opacity-100 group-hover:delay-100",
                        "group-focus-within:translate-x-0 group-focus-within:opacity-100",
                      )}
                    >
                      {label}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
