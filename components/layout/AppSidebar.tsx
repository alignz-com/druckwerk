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
  const logoSrc = collapsed ? "/logo-mark.svg" : "/logo.svg";
  const logoWidth = collapsed ? 48 : 120;
  const logoHeight = collapsed ? 48 : 40;

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
          "flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm",
          "lg:sticky lg:top-10 lg:max-h-[calc(100vh-5rem)]",
        )}
      >
        <div
          className={cn(
            "flex items-center border-b border-slate-200 px-5 py-4",
            "justify-center",
            collapsed && "px-3",
          )}
        >
          <Link
            href="/"
            className="flex items-center justify-center rounded-xl"
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
            "hidden lg:flex flex-1 px-4 py-4",
            collapsed && "flex-col items-center justify-center px-2 py-6",
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
            "border-t border-slate-200 px-5 py-4 text-sm text-slate-600",
            collapsed
              ? "flex flex-col items-center gap-4 px-3 py-4 text-xs"
              : "space-y-3",
          )}
        >
          <div
            className={cn(
              "flex w-full items-center justify-between gap-3",
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
            <div
              className={cn(
                "flex items-center gap-2",
                collapsed && "flex-col gap-2",
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
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
              <UserSettingsDialog />
            </div>
          </div>
          <div className={collapsed ? "flex justify-center" : undefined}>
            <LogoutButton label={logoutLabel} iconOnly={collapsed} />
          </div>
        </div>
      </div>
    </aside>
  );
}
