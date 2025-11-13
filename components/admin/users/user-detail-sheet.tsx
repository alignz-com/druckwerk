"use client";

import type { MouseEvent } from "react";
import { useEffect, useState } from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "@/components/providers/locale-provider";
import type { AdminUserSummary } from "@/lib/admin/users-data";
import { LoadingButton } from "@/components/ui/loading-button";
import { formatDateTime } from "@/lib/formatDateTime";

const ROLE_OPTIONS = ["USER", "ADMIN", "BRAND_ADMIN", "PRINTER"] as const;
type RoleOption = typeof ROLE_OPTIONS[number];

type BrandOption = {
  id: string;
  name: string;
  slug: string;
};

type Props = {
  user: AdminUserSummary | null;
  brandOptions: BrandOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: (user: AdminUserSummary) => void;
  onUserDeleted?: (userId: string) => void;
};

const UNASSIGNED_BRAND_VALUE = "__unassigned_brand__";

export function UserDetailSheet({
  user,
  brandOptions,
  open,
  onOpenChange,
  onUserUpdated,
  onUserDeleted,
}: Props) {
  const t = useTranslations("admin.users");
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleOption>("USER");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setSelectedBrandId(user.brandId ?? null);
      setSelectedRole((ROLE_OPTIONS.includes(user.role as RoleOption) ? user.role : "USER") as RoleOption);
    }
    setError(null);
    setSuccess(null);
  }, [user]);

  const handleSave = async (event?: MouseEvent<HTMLButtonElement>) => {
    if (!user) return;
    event?.currentTarget.blur();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: selectedBrandId, role: selectedRole }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.user) {
        throw new Error(payload?.error ?? t("detail.errors.updateFailed"));
      }

      onUserUpdated(payload.user as AdminUserSummary);
      setSuccess(t("detail.success"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("detail.errors.updateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    const displayName = user.name?.trim() ? user.name : user.email;
    const confirmed = window.confirm(t("detail.deleteConfirm", { name: displayName }));
    if (!confirmed) return;
    setIsDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? t("detail.errors.deleteFailed"));
      }
      onOpenChange(false);
      onUserDeleted?.(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("detail.errors.deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  };

  const disableFooter = isSaving || isDeleting;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full max-w-xl flex-col p-0">
        {user ? (
          <>
            <SheetHeader className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-5 text-left">
              <SheetTitle>{user.name ?? user.email}</SheetTitle>
              <SheetDescription>{user.email}</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{t("detail.metadata.title")}</h3>
                  <p className="text-xs text-slate-500">{t("detail.metadata.description")}</p>
                </div>
                <dl className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">{t("detail.metadata.role")}</dt>
                    <dd className="font-medium text-slate-900">{user.role}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">{t("detail.metadata.brand")}</dt>
                    <dd className="font-medium text-slate-900">{user.brandName ?? t("detail.metadata.unassigned")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">{t("detail.metadata.created")}</dt>
                    <dd>{formatDateTime(user.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">{t("detail.metadata.updated")}</dt>
                    <dd>{formatDateTime(user.updatedAt)}</dd>
                  </div>
                </dl>
              </section>

              <Separator />

              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{t("detail.role.title")}</h3>
                  <p className="text-xs text-slate-500">{t("detail.role.description")}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-role-select">{t("detail.role.label")}</Label>
                  <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as RoleOption)}>
                    <SelectTrigger id="user-role-select" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role}>
                          {t(`detail.role.options.${role}` as const)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </section>

              <Separator />

              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{t("detail.assignment.title")}</h3>
                  <p className="text-xs text-slate-500">{t("detail.assignment.description")}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-brand-select">{t("detail.assignment.brandLabel")}</Label>
                  <Select
                    value={selectedBrandId ?? UNASSIGNED_BRAND_VALUE}
                    onValueChange={(value) => setSelectedBrandId(value === UNASSIGNED_BRAND_VALUE ? null : value)}
                  >
                    <SelectTrigger id="user-brand-select" className="w-full">
                      <SelectValue placeholder={t("detail.assignment.placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_BRAND_VALUE}>{t("detail.assignment.unassigned")}</SelectItem>
                      {brandOptions.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </section>

              {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
            <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-slate-200 bg-white/95 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={disableFooter}>
                {t("detail.close")}
              </Button>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <LoadingButton
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  loading={isDeleting}
                  loadingText={t("detail.deleting")}
                  minWidthClassName="min-w-[160px]"
                  disabled={isSaving}
                >
                  {t("detail.deleteButton")}
                </LoadingButton>
                <LoadingButton
                  onClick={handleSave}
                  loading={isSaving}
                  loadingText={t("detail.saving")}
                  minWidthClassName="min-w-[160px]"
                  disabled={isDeleting}
                >
                  {t("detail.saveButton")}
                </LoadingButton>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
