import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getServerAuthSession } from "@/lib/auth";
import type { NavGroup } from "@/components/layout/SidebarNav";
import { getTranslations, isLocale } from "@/lib/i18n/messages";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { CommandPalette } from "@/components/layout/CommandPalette";

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
    ...(isAdmin || isPrinter ? [
      { href: "/confirmations", label: t.nav.deliveries, icon: "deliveries" },
      { href: "/lieferscheine", label: t.nav.lieferscheine, icon: "lieferscheine" },
    ] : []),
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
        { href: "/admin/features", label: t.nav.adminFeatures, icon: "admin-features" },
        { href: "/admin/settings", label: t.nav.adminSettings, icon: "admin-settings" },
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
      group: group.title ?? t.nav.cmdKGroupNavigation,
      iconKey: item.icon ?? "",
    }))
  );

  const cmdActions = [
    { href: "/orders/new", label: t.nav.cmdKNewOrder, group: t.nav.cmdKGroupActions, iconKey: "new-order" },
    ...(isAdmin ? [
      { href: "/admin/brands/new", label: t.nav.cmdKNewBrand, group: t.nav.cmdKGroupActions, iconKey: "admin-brands" },
      { href: "/admin/templates/new", label: t.nav.cmdKNewTemplate, group: t.nav.cmdKGroupActions, iconKey: "admin-templates" },
      { href: "/admin/users?new=1", label: t.nav.cmdKNewUser, group: t.nav.cmdKGroupActions, iconKey: "admin-users" },
      { href: "/admin/products?new=1", label: t.nav.cmdKNewProduct, group: t.nav.cmdKGroupActions, iconKey: "admin-products" },
      { href: "/admin/formats?new=1", label: t.nav.cmdKNewFormat, group: t.nav.cmdKGroupActions, iconKey: "admin-formats" },
      { href: "/admin/papers?new=1", label: t.nav.cmdKNewPaper, group: t.nav.cmdKGroupActions, iconKey: "admin-papers" },
      { href: "/admin/finishes?new=1", label: t.nav.cmdKNewFinish, group: t.nav.cmdKGroupActions, iconKey: "admin-finishes" },
      { href: "/admin/fonts?new=1", label: t.nav.cmdKNewFont, group: t.nav.cmdKGroupActions, iconKey: "admin-fonts" },
      { href: "/admin/features?new=1", label: t.nav.cmdKNewFeature, group: t.nav.cmdKGroupActions, iconKey: "admin-features", keywords: ["feature", "bug", "idea"] },
    ] : []),
  ];

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
          actions={cmdActions}
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
