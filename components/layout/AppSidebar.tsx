"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

import LogoutButton from "@/components/layout/LogoutButton";
import UserSettingsDialog from "@/components/UserSettingsDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { SidebarNav, type NavGroup } from "./SidebarNav";

type Props = {
  navGroups: NavGroup[];
  displayName: string;
  initials: string;
  roleLabel?: string | null;
  brandTitle: string;
  logoutLabel: string;
  collapseLabel: string;
  expandLabel: string;
};

export function AppSidebar({
  navGroups,
  displayName,
  initials,
  roleLabel,
  brandTitle,
  logoutLabel,
  collapseLabel,
  expandLabel,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapsed = () => setCollapsed((prev) => !prev);

  return (
    <aside
      className={cn(
        "transition-[width] duration-200 lg:shrink-0",
        collapsed ? "lg:w-20" : "lg:w-64",
      )}
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div
        className={cn(
          "rounded-2xl border border-slate-200 bg-white shadow-sm",
          "lg:sticky lg:top-10 lg:max-h-[calc(100vh-5rem)] lg:overflow-hidden",
        )}
      >
        <div
          className={cn(
            "flex items-center border-b border-slate-200 px-5 py-4",
            collapsed ? "justify-center gap-2 px-3" : "justify-between gap-4",
          )}
        >
          <Link
            href="/"
            className={cn(
              "flex items-center justify-center",
              collapsed ? "px-1" : "w-full",
            )}
          >
            <Image
              src="/logo.svg"
              alt={brandTitle}
              width={collapsed ? 36 : 120}
              height={40}
              priority
            />
            <span className="sr-only">{brandTitle}</span>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "hidden rounded-full border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 lg:inline-flex",
              collapsed && "border-none bg-transparent hover:bg-slate-100",
            )}
            onClick={toggleCollapsed}
            aria-label={collapsed ? expandLabel : collapseLabel}
            title={collapsed ? expandLabel : collapseLabel}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <ChevronsLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className={cn("px-4 py-4 hidden lg:block", collapsed && "px-2 py-3")}>
          <SidebarNav groups={navGroups} collapsed={collapsed} />
        </div>

        <div
          className={cn(
            "space-y-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-600",
            collapsed && "items-center px-3 text-xs",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between gap-3",
              collapsed && "flex-col gap-3",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-3",
                collapsed && "flex-col gap-2 text-center",
              )}
            >
              <Avatar className="size-10 bg-slate-200">
                <AvatarFallback className="font-semibold text-slate-700">
                  {initials || "BC"}
                </AvatarFallback>
              </Avatar>
              {!collapsed ? (
                <div className="text-sm">
                  <div className="font-semibold text-slate-900">{displayName}</div>
                  {roleLabel ? (
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      {roleLabel}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <UserSettingsDialog />
          </div>
          <LogoutButton label={logoutLabel} iconOnly={collapsed} />
        </div>
      </div>
    </aside>
  );
}
