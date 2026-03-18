"use client";

import { useMemo, useState } from "react";

import type { AdminUserSummary } from "@/lib/admin/users-data";
import { useLocale, useTranslations } from "@/components/providers/locale-provider";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/formatDateTime";

import { UsersTable } from "./UsersTable";
import { UserDetailSheet } from "./UserDetailSheet";
import { UserCreateSheet } from "./UserCreateSheet";

type BrandOption = {
  id: string;
  name: string;
  slug: string;
};

type Props = {
  users: AdminUserSummary[];
  brands: BrandOption[];
};

type SheetState = { mode: "view"; userId: string } | { mode: "create" } | null;

export default function AdminUsersClient({ users, brands }: Props) {
  const t = useTranslations("admin.users");
  const roleT = useTranslations("layout.roles");
  const { locale } = useLocale();
  const [entries, setEntries] = useState(users);
  const [sheetState, setSheetState] = useState<SheetState>(null);

  const activeUser = useMemo(() => {
    if (sheetState?.mode !== "view") return null;
    return entries.find((user) => user.id === sheetState.userId) ?? null;
  }, [sheetState, entries]);

  const handleBrandUpdate = (updatedUser: AdminUserSummary) => {
    setEntries((current) =>
      current.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
    );
    setSheetState({ mode: "view", userId: updatedUser.id });
  };

  const handleUserCreated = (createdUser: AdminUserSummary) => {
    setEntries((current) => [createdUser, ...current]);
    setSheetState({ mode: "view", userId: createdUser.id });
  };

  const handleUserDeleted = (userId: string) => {
    setEntries((current) => current.filter((user) => user.id !== userId));
    setSheetState(null);
  };

  const tableData = useMemo(
    () =>
      entries.map((user) => ({
        id: user.id,
        displayName: user.name || user.email,
        email: user.email,
        role: user.role,
        roleLabel: roleT(user.role as any) ?? user.role,
        brandName: user.brandName,
        brandId: user.brandId,
        createdAtValue: new Date(user.createdAt).getTime(),
        createdAtLabel: formatDateTime(user.createdAt, locale, { dateStyle: "medium" }),
      })),
    [entries, roleT, locale],
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-slate-500">{t("description")}</p>
        </div>
        <Button onClick={() => setSheetState({ mode: "create" })} className="inline-flex items-center gap-2 self-start sm:self-auto">
          <Plus className="size-4" />
          {t("actions.new")}
        </Button>
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
        allRolesLabel={t("table.allRoles")}
        allBrandsLabel={t("table.allBrands")}
        columns={{
          user: t("table.headers.user"),
          email: t("table.headers.email"),
          role: t("table.headers.role"),
          brand: t("table.headers.brand"),
        }}
        onManage={(id) => setSheetState({ mode: "view", userId: id })}
      />

      <UserDetailSheet
        user={activeUser}
        brandOptions={brands}
        open={sheetState?.mode === "view" && Boolean(activeUser)}
        onOpenChange={(open) => (!open ? setSheetState(null) : null)}
        onUserUpdated={handleBrandUpdate}
        onUserDeleted={handleUserDeleted}
      />

      <UserCreateSheet
        open={sheetState?.mode === "create"}
        onOpenChange={(open) => (!open ? setSheetState(null) : null)}
        brandOptions={brands}
        onCreated={handleUserCreated}
      />
    </div>
  );
}
