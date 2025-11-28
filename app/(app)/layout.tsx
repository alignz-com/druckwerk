import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getServerAuthSession } from "@/lib/auth";
import type { NavGroup } from "@/components/layout/SidebarNav";
import { getTranslations, isLocale } from "@/lib/i18n/messages";
import { AppSidebar } from "@/components/layout/AppSidebar";

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
  const isAdmin = session.user.role === "ADMIN";
  const isPrinter = session.user.role === "PRINTER";
  const primaryNav = [
    { href: "/orders/new", label: t.nav.newOrder, icon: "new-order" },
    { href: "/orders", label: t.nav.orders, icon: "orders" },
    ...(isAdmin || isPrinter ? [{ href: "/deliveries", label: t.nav.deliveries, icon: "deliveries" }] : []),
  ];
  const adminNav = isAdmin
    ? [
        { href: "/admin/brands", label: t.nav.adminBrands, icon: "admin-brands" },
        { href: "/admin/users", label: t.nav.adminUsers, icon: "admin-users" },
        { href: "/admin/templates", label: t.nav.adminTemplates, icon: "admin-templates" },
        { href: "/admin/fonts", label: t.nav.adminFonts, icon: "admin-fonts" },
      ]
    : [];

  const navGroups: NavGroup[] = [{ items: primaryNav }];
  if (adminNav.length > 0) {
    navGroups.push({ title: t.nav.adminGroup, items: adminNav });
  }
  const roleLabel = session.user.role ? t.layout.roles[session.user.role] ?? session.user.role : null;
  const settingsLabel = t.layout.settings.open;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-[2000px] flex-col gap-8 px-4 py-6 lg:flex-row lg:px-12 lg:py-10">
        <AppSidebar
          navGroups={navGroups}
          displayName={displayName}
          initials={initials}
          roleLabel={roleLabel}
          brandTitle={t.layout.brandTitle}
          logoutLabel={t.nav.logout}
          settingsLabel={settingsLabel}
        />
        <main className="flex-1 lg:pl-6">
          <header className="mb-6 block lg:hidden">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">{t.layout.signedInAs}</div>
              <div className="text-base font-semibold text-slate-900">{displayName}</div>
              <div className="mt-4 space-y-4">
                {navGroups.map((group, idx) => (
                  <div key={group.title ?? `mobile-group-${idx}`} className="space-y-2">
                    {group.title ? <div className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.title}</div> : null}
                    <div className="flex flex-col gap-2">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
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
