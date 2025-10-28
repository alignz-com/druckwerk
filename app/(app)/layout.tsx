import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, PlusCircle, ShieldCheck } from "lucide-react";

import { getServerAuthSession } from "@/lib/auth";
import { SidebarNav } from "@/components/layout/SidebarNav";
import LogoutButton from "@/components/layout/LogoutButton";

type Props = {
  children: ReactNode;
};

export default async function AppLayout({ children }: Props) {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/login");
  }

  const displayName = session.user.name || session.user.email || "Account";
  const menuItems = [
    { href: "/orders", label: "Orders", Icon: ClipboardList },
    { href: "/orders/new", label: "New Order", Icon: PlusCircle },
    ...(session.user.role === "ADMIN"
      ? [{ href: "/admin/brands", label: "Admin · Brands", Icon: ShieldCheck }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 lg:flex-row lg:px-8">
        <aside className="lg:w-64">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <Link href="/" className="block">
                <span className="text-sm font-semibold text-slate-900">Omicron</span>
                <span className="block text-xs text-slate-500">Business Card Portal</span>
              </Link>
            </div>

            <div className="px-4 py-3">
              <SidebarNav items={menuItems} />
            </div>

            <div className="space-y-2 border-t border-slate-200 px-5 py-4 text-sm text-slate-600">
              <div>
                <div className="font-semibold text-slate-900">{displayName}</div>
                {session.user.role ? (
                  <div className="text-xs uppercase tracking-wide text-slate-400">{session.user.role}</div>
                ) : null}
              </div>
              <LogoutButton />
            </div>
          </div>
        </aside>

        <main className="flex-1">
          <header className="mb-6 lg:hidden">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Signed in as</div>
              <div className="text-base font-semibold text-slate-900">{displayName}</div>
              <div className="mt-3 flex gap-3">
                {menuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </header>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
