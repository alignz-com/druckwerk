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
import { AdminPasswordReset } from "./AdminPasswordReset";

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

type UserAccessValues = {
  canUseTemplates: boolean | null
  canUploadFiles: boolean | null
}

function UserAccessSection({ userId, initialValues }: { userId: string; initialValues: UserAccessValues }) {
  const t = useTranslations("admin.products.userAccess")
  const [bc, setBc] = useState<boolean | null>(initialValues.canUseTemplates)
  const [pdf, setPdf] = useState<boolean | null>(initialValues.canUploadFiles)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setBc(initialValues.canUseTemplates)
    setPdf(initialValues.canUploadFiles)
    setSaved(false)
  }, [userId, initialValues.canUseTemplates, initialValues.canUploadFiles])

  const hasChanges =
    bc !== initialValues.canUseTemplates || pdf !== initialValues.canUploadFiles

  async function save() {
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canUseTemplates: bc, canUploadFiles: pdf }),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
    } catch {
      setErr(t("error"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{t("title")}</h3>
        <p className="text-xs text-slate-500">{t("description")}</p>
      </div>

      {err && <p className="text-xs text-red-600">{err}</p>}
      {saved && <p className="text-xs text-emerald-600">{t("saved")}</p>}

      <div className="space-y-2">
        {[
          { label: "Business Cards", value: bc, set: setBc },
          { label: "PDF Print", value: pdf, set: setPdf },
        ].map(({ label, value, set }) => (
          <div key={label} className="flex items-center gap-3">
            <Select
              value={value === null ? "inherit" : value ? "yes" : "no"}
              onValueChange={(v) => {
                set(v === "inherit" ? null : v === "yes")
                setSaved(false)
              }}
            >
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">Inherit</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-slate-700">{label}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!hasChanges || saving}
          onClick={() => {
            setBc(initialValues.canUseTemplates)
            setPdf(initialValues.canUploadFiles)
            setSaved(false)
          }}
        >
          {t("reset")}
        </Button>
        <LoadingButton size="sm" disabled={!hasChanges} loading={saving} loadingText="…" minWidthClassName="min-w-[60px]" onClick={save}>
          {t("save")}
        </LoadingButton>
      </div>
    </section>
  )
}

function DemoSection({ userId, initialIsDemo }: { userId: string; initialIsDemo: boolean }) {
  const [isDemo, setIsDemo] = useState(initialIsDemo);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setIsDemo(initialIsDemo);
    setSaved(false);
  }, [userId, initialIsDemo]);

  const hasChanges = isDemo !== initialIsDemo;

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDemo }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
    } catch {
      setErr("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Demo Account</h3>
        <p className="text-xs text-slate-500">Demo users can use the order form but orders are not saved to the database.</p>
      </div>

      {err && <p className="text-xs text-red-600">{err}</p>}
      {saved && <p className="text-xs text-emerald-600">Saved</p>}

      <div className="flex items-center gap-3">
        <Select
          value={isDemo ? "yes" : "no"}
          onValueChange={(v) => {
            setIsDemo(v === "yes");
            setSaved(false);
          }}
        >
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="no">No</SelectItem>
            <SelectItem value="yes">Demo</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-700">Demo account</span>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!hasChanges || saving}
          onClick={() => {
            setIsDemo(initialIsDemo);
            setSaved(false);
          }}
        >
          Reset
        </Button>
        <LoadingButton size="sm" disabled={!hasChanges} loading={saving} loadingText="…" minWidthClassName="min-w-[60px]" onClick={save}>
          Save
        </LoadingButton>
      </div>
    </section>
  );
}

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

              <Separator />

              <UserAccessSection
                userId={user.id}
                initialValues={{
                  canUseTemplates: user.canUseTemplates,
                  canUploadFiles: user.canUploadFiles,
                }}
              />

              <Separator />

              <DemoSection userId={user.id} initialIsDemo={user.isDemo} />

              <Separator />

              <AdminPasswordReset userId={user.id} />

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
