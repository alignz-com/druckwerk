"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  iconOnly?: boolean;
};

export default function LogoutButton({ label = "Logout", iconOnly = false }: Props) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={cn(
        "flex items-center justify-center gap-2 border border-slate-200 text-sm font-medium text-slate-700 transition hover:bg-slate-100",
        iconOnly
          ? "h-11 w-11 rounded-full bg-white"
          : "w-full rounded-xl px-3 py-2",
      )}
      aria-label={label}
    >
      <LogOut className="size-4" />
      <span className={cn(iconOnly && "sr-only")}>{label}</span>
    </button>
  );
}
