"use client";

import { type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import LogoutButton from "@/components/layout/LogoutButton";
import UserSettingsDialog from "@/components/UserSettingsDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { SidebarNav, type NavGroup } from "./SidebarNav";

type Props = {
  navGroups: NavGroup[];
  displayName: string;
  initials: string;
  roleLabel?: string | null;
  brandTitle: string;
  logoutLabel: string;
  settingsLabel: string;
  hasPassword?: boolean;
};

type SidebarTooltipProps = {
  label: string;
  children: ReactNode;
  show?: boolean;
  className?: string;
};

function SidebarTooltip({ label, children, show = true, className }: SidebarTooltipProps) {
  return (
    <div className={cn("group relative flex", className)}>
      {children}
      {show ? (
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
}

export function AppSidebar({
  navGroups,
  displayName,
  initials,
  roleLabel,
  brandTitle,
  logoutLabel,
  settingsLabel,
  hasPassword = false,
}: Props) {
  const collapsed = true;
  const logoSrc = collapsed ? "/logo-mark.svg" : "/logo.svg";
  const logoWidth = collapsed ? 45 : 180;
  const logoHeight = collapsed ? 45 : 48;

  return (
    <aside
      className={cn(
        "hidden lg:block transition-[width] duration-200 lg:shrink-0",
        collapsed ? "lg:w-20" : "lg:w-64",
      )}
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div
        className={cn(
          "flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm",
          "lg:sticky lg:top-10 lg:z-10",
          "lg:max-h-[calc(100vh-5rem)]",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center border-b border-slate-200 px-5 py-4",
            "justify-center",
            collapsed && "px-3",
          )}
        >
          <Link
            href="/"
            className={cn(
              "flex items-center rounded-xl",
              "justify-center",
            )}
          >
            <Image
              src={logoSrc}
              alt={brandTitle}
              width={logoWidth}
              height={logoHeight}
              priority
            />
            <span className="sr-only">{brandTitle}</span>
          </Link>
        </div>

        <div
          className={cn(
            "hidden min-h-0 flex-1 overflow-y-auto lg:block px-4 py-4",
            collapsed && "px-0 py-5",
          )}
        >
          <SidebarNav
            groups={navGroups}
            collapsed={collapsed}
            className={collapsed ? "items-center" : undefined}
          />
        </div>

        <div
          className={cn(
            "shrink-0 border-t border-slate-200 text-sm text-slate-600",
            collapsed ? "px-3 py-4" : "px-5 py-4",
          )}
        >
          {collapsed ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <SidebarTooltip label={displayName} className="justify-center">
                <Avatar className="size-10 bg-slate-200">
                  <AvatarFallback className="font-semibold text-slate-700">
                    {initials || "BC"}
                  </AvatarFallback>
                </Avatar>
              </SidebarTooltip>
              <div className="flex justify-center">
                <UserSettingsDialog showTooltip tooltip={settingsLabel} hasPassword={hasPassword} />
              </div>
              <SidebarTooltip label={logoutLabel} className="justify-center">
                <LogoutButton label={logoutLabel} iconOnly />
              </SidebarTooltip>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <SidebarTooltip label={displayName} show={false}>
                    <Avatar className="size-10 bg-slate-200">
                      <AvatarFallback className="font-semibold text-slate-700">
                        {initials || "BC"}
                      </AvatarFallback>
                    </Avatar>
                  </SidebarTooltip>
                  <div className="text-sm">
                    <div className="font-semibold text-slate-900">{displayName}</div>
                    {roleLabel ? (
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        {roleLabel}
                      </div>
                    ) : null}
                  </div>
                </div>
                <UserSettingsDialog tooltip={settingsLabel} hasPassword={hasPassword} />
              </div>
              <SidebarTooltip label={logoutLabel} show={false} className="mt-4 w-full">
                <LogoutButton label={logoutLabel} />
              </SidebarTooltip>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
