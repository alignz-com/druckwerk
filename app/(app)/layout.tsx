import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getServerAuthSession } from "@/lib/auth";
import type { NavGroup } from "@/components/layout/SidebarNav";
import { getTranslations, isLocale } from "@/lib/i18n/messages";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { CommandPalette, NAV_ICONS } from "@/components/layout/CommandPalette";

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
        { href: "/admin/products", label: t.nav.adminProducts, icon: "admin-products" },
        { href: "/admin/formats", label: t.nav.adminFormats, icon: "admin-formats" },
        { href: "/admin/finishes", label: t.nav.adminFinishes, icon: "admin-finishes" },
        { href: "/admin/papers", label: t.nav.adminPapers, icon: "admin-papers" },
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
  const hasPassword = Boolean(session.user.hasPassword);

  const cmdItems = navGroups.flatMap((group) =>
    group.items.map((item) => ({
      href: item.href,
      label: item.label,
      group: group.title ?? t.nav.newOrder,
      icon: NAV_ICONS[item.icon ?? ""] ?? NAV_ICONS["orders"],
    }))
  );

  return (
    <div className="min-h-screen bg-white lg:bg-slate-50">
      <div className="mx-auto flex w-full max-w-[2000px] flex-col gap-8 lg:flex-row lg:px-12 lg:py-10">
        {/* Desktop sidebar — hidden on mobile */}
        <AppSidebar
          navGroups={navGroups}
          displayName={displayName}
          initials={initials}
          roleLabel={roleLabel}
          brandTitle={t.layout.brandTitle}
          logoutLabel={t.nav.logout}
          settingsLabel={settingsLabel}
          hasPassword={hasPassword}
        />

        {/* Mobile bottom nav — hidden on desktop */}
        <MobileNav
          navGroups={navGroups}
          displayName={displayName}
          initials={initials}
          roleLabel={roleLabel}
          logoutLabel={t.nav.logout}
          moreLabel={t.nav.more}
          hasPassword={hasPassword}
        />

        <CommandPalette
          items={cmdItems}
          placeholder={t.nav.cmdKPlaceholder}
          noResultsLabel={t.nav.cmdKNoResults}
        />

        <main className="flex-1 min-w-0 lg:pl-6">
          {/* Extra bottom padding on mobile so content clears the bottom nav bar */}
          <div className="bg-white px-4 pb-24 sm:px-6 sm:pb-24 lg:rounded-3xl lg:border lg:border-slate-200 lg:shadow-sm lg:px-12 lg:py-10 lg:pb-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
