"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, ClipboardList, LayoutTemplate, Layers, Lightbulb, Package, PlusCircle, Ruler, Settings, ShieldCheck, Sparkles, Truck, Type, Users, type LucideIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  orders: ClipboardList,
  "new-order": PlusCircle,
  deliveries: ClipboardCheck,
  lieferscheine: Truck,
  "admin-brands": ShieldCheck,
  "admin-users": Users,
  "admin-products": Package,
  "admin-formats": Ruler,
  "admin-finishes": Sparkles,
  "admin-papers": Layers,
  "admin-templates": LayoutTemplate,
  "admin-fonts": Type,
  "admin-features": Lightbulb,
  "admin-settings": Settings,
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
  const groupSpacing = collapsed ? "space-y-2" : "space-y-4";
  const itemsGap = collapsed ? "gap-2" : "gap-4";

  return (
    <TooltipProvider delayDuration={150}>
    <nav className={cn("flex flex-col gap-4", className)}>
      {groups.map((group, idx) => (
        <div
          key={group.title ?? `group-${idx}`}
          className={cn(
            groupSpacing,
            idx > 0 && "border-t border-slate-200 pt-3",
            idx > 0 && !collapsed && "mt-4",
            idx > 0 && collapsed && "mt-1",
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
              const segments = href.split("/").filter(Boolean).length;
              const active = pathname === href || (segments >= 2 && pathname.startsWith(`${href}/`));
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

              const linkEl = (
                <Link
                  href={href}
                  className={linkClasses}
                  aria-label={collapsed ? label : undefined}
                >
                  {IconComponent ? (
                    <IconComponent className="size-5 shrink-0" />
                  ) : null}
                  {!collapsed ? <span className="truncate">{label}</span> : null}
                </Link>
              );

              return (
                <div key={href} className="relative">
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                      <TooltipContent side="right" sideOffset={12}>
                        {label}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    linkEl
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
    </TooltipProvider>
  );
}
