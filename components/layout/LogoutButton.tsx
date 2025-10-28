"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

type Props = {
  label?: string;
};

export default function LogoutButton({ label = "Logout" }: Props) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
    >
      <LogOut className="size-4" />
      {label}
    </button>
  );
}
