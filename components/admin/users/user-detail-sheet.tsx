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
};

const UNASSIGNED_BRAND_VALUE = "__unassigned_brand__";

export function UserDetailSheet({ user, brandOptions, open, onOpenChange, onUserUpdated }: Props) {
  const t = useTranslations("admin.users");
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setSelectedBrandId(user.brandId ?? null);
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
        body: JSON.stringify({ brandId: selectedBrandId }),
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full max-w-xl flex-col p-0">
        {user ? (
          <>
            <SheetHeader className="border-b border-slate-200 px-6 py-5 text-left">
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
                    <dd>{new Date(user.createdAt).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">{t("detail.metadata.updated")}</dt>
                    <dd>{new Date(user.updatedAt).toLocaleString()}</dd>
                  </div>
                </dl>
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
            <div className="flex justify-between border-t border-slate-200 px-6 py-4">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isSaving}>
                {t("detail.close")}
              </Button>
              <LoadingButton
                onClick={handleSave}
                loading={isSaving}
                loadingText={t("detail.saving")}
                minWidthClassName="min-w-[180px]"
              >
                {t("detail.saveButton")}
              </LoadingButton>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
