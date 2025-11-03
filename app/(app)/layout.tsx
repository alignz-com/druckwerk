import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getServerAuthSession } from "@/lib/auth";
import { SidebarNav } from "@/components/layout/SidebarNav";
import LogoutButton from "@/components/layout/LogoutButton";
import UserSettingsDialog from "@/components/UserSettingsDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getTranslations, isLocale } from "@/lib/i18n/messages";

type Props = {
  children: ReactNode;
};

export default async function AppLayout({ children }: Props) {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale")?.value;
  const userLocale = session.user.locale;
  const locale = isLocale(localeCookie)
    ? localeCookie
    : isLocale(userLocale)
      ? userLocale
      : "en";
  const t = getTranslations(locale);

  const displayName = session.user.name || session.user.email || "Account";
  const initials = displayName
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "BC";
  const menuItems = [
    { href: "/orders", label: t.nav.orders, icon: "orders" },
    { href: "/orders/new", label: t.nav.newOrder, icon: "new-order" },
    ...(session.user.role === "ADMIN"
      ? [{ href: "/admin/brands", label: t.nav.adminBrands, icon: "admin-brands" }]
      : []),
  ];
  const roleLabel = session.user.role ? t.layout.roles[session.user.role] ?? session.user.role : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-[2000px] flex-col gap-8 px-4 py-6 lg:flex-row lg:px-12 lg:py-10">
        <aside className="lg:w-64 lg:shrink-0">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-10 lg:max-h-[calc(100vh-5rem)] lg:overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <Link href="/" className="flex items-center justify-center">
                <Image src="/logo.svg" alt={t.layout.brandTitle} width={120} height={40} priority />
                <span className="sr-only">{t.layout.brandTitle}</span>
              </Link>
            </div>

            <div className="px-4 py-4 hidden lg:block">
              <SidebarNav items={menuItems} />
            </div>

            <div className="space-y-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10 bg-slate-200">
                    <AvatarFallback className="font-semibold text-slate-700">{initials || "BC"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-slate-900">{displayName}</div>
                    {roleLabel ? (
                      <div className="text-xs uppercase tracking-wide text-slate-400">{roleLabel}</div>
                    ) : null}
                  </div>
                </div>
                <UserSettingsDialog />
              </div>
              <LogoutButton label={t.nav.logout} />
            </div>
          </div>
        </aside>
        <main className="flex-1 lg:pl-6">
          <header className="mb-6 block lg:hidden">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">{t.layout.signedInAs}</div>
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

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
