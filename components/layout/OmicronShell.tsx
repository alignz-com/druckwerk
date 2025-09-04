"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";

type ShellProps = {
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export default function OmicronShell({ sidebar, header, children, className }: ShellProps) {
  return (
    <div className="min-h-screen w-full bg-muted/20 text-slate-900">
      <div className={cn("mx-auto flex max-w-[1400px] gap-0 p-0 md:gap-6 md:p-6", className)}>
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-[100dvh] w-72 shrink-0 flex-col justify-between border-r bg-white md:flex rounded-2xl">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-3 p-5">
              <div className="size-9 rounded-xl bg-indigo-600" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-500 leading-none">Omicron</span>
                <span className="text-base font-semibold leading-tight">Business Cards</span>
              </div>
            </div>
            <Separator />
            {sidebar}
          </div>

          {/* User block */}
          <div className="p-4">
            <div className="flex items-center gap-3 rounded-xl border p-3">
              <Avatar className="size-10">
                <AvatarFallback>PR</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">Pascal Rossi</div>
                <div className="truncate text-xs text-slate-500">pascal@omicron.example</div>
              </div>
              <Button size="icon" variant="ghost" className="ml-auto" title="Sign out">
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex min-h-[100dvh] flex-1 flex-col gap-4 p-5 md:p-0">
          {header}
          <div className="flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}
