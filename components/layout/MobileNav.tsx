"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  ClipboardList,
  Layers,
  MoreHorizontal,
  PlusCircle,
  ShieldCheck,
  Type,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Sheet, BottomSheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import LogoutButton from "./LogoutButton";
import UserSettingsDialog from "@/components/UserSettingsDialog";
import type { NavGroup } from "./SidebarNav";

const ICONS: Record<string, LucideIcon> = {
  orders: ClipboardList,
  "new-order": PlusCircle,
  deliveries: ClipboardCheck,
  "admin-brands": ShieldCheck,
  "admin-users": Users,
  "admin-templates": Layers,
  "admin-fonts": Type,
};

type Props = {
  navGroups: NavGroup[];
  displayName: string;
  initials: string;
  roleLabel?: string | null;
  logoutLabel: string;
  settingsLabel: string;
  moreLabel: string;
};

export function MobileNav({
  navGroups,
  displayName,
  initials,
  roleLabel,
  logoutLabel,
  settingsLabel,
  moreLabel,
}: Props) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = navGroups[0]?.items ?? [];
  const secondaryGroups = navGroups.slice(1);

  return (
    <>
      {/* Fixed bottom tab bar — mobile only */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-16 items-stretch">
          {primaryItems.map(({ href, label, icon }) => {
            const active = pathname === href;
            const IconComponent = icon ? ICONS[icon] : undefined;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors",
                  active ? "text-slate-900" : "text-slate-400 hover:text-slate-600",
                )}
              >
                {IconComponent ? (
                  <IconComponent className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                ) : null}
                <span className="truncate leading-none">{label}</span>
                {active ? (
                  <span className="absolute bottom-0 h-[3px] w-10 rounded-t-full bg-slate-900" />
                ) : null}
              </Link>
            );
          })}

          {/* More button */}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors",
              moreOpen ? "text-slate-900" : "text-slate-400 hover:text-slate-600",
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="leading-none">{moreLabel}</span>
          </button>
        </div>
      </nav>

      {/* "More" bottom sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <BottomSheetContent>
          <SheetTitle className="sr-only">{moreLabel}</SheetTitle>

          {/* User info */}
          <div className="flex items-center gap-3 px-5 py-4">
            <Avatar className="size-10 shrink-0 bg-slate-200">
              <AvatarFallback className="font-semibold text-slate-700">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{displayName}</div>
              {roleLabel ? <div className="text-xs text-slate-500">{roleLabel}</div> : null}
            </div>
          </div>

          <Separator />

          {/* Secondary nav groups (admin links etc.) */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {secondaryGroups.map((group, idx) => (
              <div key={group.title ?? `more-group-${idx}`} className="mb-3">
                {group.title ? (
                  <div className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {group.title}
                  </div>
                ) : null}
                <div className="flex flex-col gap-0.5">
                  {group.items.map(({ href, label, icon }) => {
                    const active = pathname === href || pathname.startsWith(`${href}/`);
                    const IconComponent = icon ? ICONS[icon] : undefined;
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-slate-900 text-white"
                            : "text-slate-700 hover:bg-slate-100",
                        )}
                      >
                        {IconComponent ? <IconComponent className="h-4 w-4 shrink-0" /> : null}
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Settings + Logout */}
          <div className="flex items-center gap-2 px-5 py-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
            <UserSettingsDialog tooltip={settingsLabel} />
            <LogoutButton label={logoutLabel} />
          </div>
        </BottomSheetContent>
      </Sheet>
    </>
  );
}
