"use client";

import { useMemo, useState } from "react";

import type { AdminUserSummary } from "@/lib/admin/users-data";
import { useTranslations } from "@/components/providers/locale-provider";

import { UsersTable } from "./users-table";
import { UserDetailSheet } from "./user-detail-sheet";

type BrandOption = {
  id: string;
  name: string;
  slug: string;
};

type Props = {
  users: AdminUserSummary[];
  brands: BrandOption[];
};

export default function AdminUsersClient({ users, brands }: Props) {
  const t = useTranslations("admin.users");
  const [entries, setEntries] = useState(users);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  const activeUser = useMemo(() => entries.find((user) => user.id === activeUserId) ?? null, [entries, activeUserId]);

  const handleBrandUpdate = (updatedUser: AdminUserSummary) => {
    setEntries((current) =>
      current.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
    );
    setActiveUserId(updatedUser.id);
  };

  const tableData = useMemo(
    () =>
      entries.map((user) => ({
        id: user.id,
        displayName: user.name || user.email,
        email: user.email,
        role: user.role,
        brandName: user.brandName,
        brandId: user.brandId,
        createdAtValue: new Date(user.createdAt).getTime(),
      })),
    [entries],
  );

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{t("title")}</h1>
        <p className="text-sm text-slate-500">{t("description")}</p>
      </header>

      <UsersTable
        data={tableData}
        searchPlaceholder={t("table.searchPlaceholder")}
        emptyState={t("table.empty")}
        noResults={t("table.noResults")}
        paginationLabel={({ from, to, total }) => t("table.pagination.label", { from, to, total })}
        previousLabel={t("table.pagination.previous")}
        nextLabel={t("table.pagination.next")}
        resetLabel={t("table.pagination.reset")}
        manageLabel={t("table.manage")}
        columns={{
          user: t("table.headers.user"),
          email: t("table.headers.email"),
          role: t("table.headers.role"),
          brand: t("table.headers.brand"),
          actions: t("table.headers.actions"),
        }}
        onManage={(id) => setActiveUserId(id)}
      />

      <UserDetailSheet
        user={activeUser}
        brandOptions={brands}
        open={Boolean(activeUser)}
        onOpenChange={(open) => (!open ? setActiveUserId(null) : null)}
        onUserUpdated={handleBrandUpdate}
      />
    </div>
  );
}
