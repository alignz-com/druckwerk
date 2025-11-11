"use client";

import { useState } from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslations } from "@/components/providers/locale-provider";
import type { AdminUserSummary } from "@/lib/admin/users-data";

type BrandOption = {
  id: string;
  name: string;
  slug: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandOptions: BrandOption[];
  onCreated: (user: AdminUserSummary) => void;
};

const ROLE_OPTIONS: Array<{ value: AdminUserSummary["role"]; label: string }> = [
  { value: "USER", label: "User" },
  { value: "ADMIN", label: "Admin" },
  { value: "PRINTER", label: "Printer" },
];

const UNASSIGNED_BRAND_VALUE = "__unassigned_brand__";

export function UserCreateSheet({ open, onOpenChange, brandOptions, onCreated }: Props) {
  const t = useTranslations("admin.users");
  const rolesT = useTranslations("layout.roles");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AdminUserSummary["role"]>("USER");
  const [brandId, setBrandId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setEmail("");
    setName("");
    setRole("USER");
    setBrandId(null);
    setPassword("");
    setIsSubmitting(false);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const payload = {
      email: email.trim(),
      name: name.trim() || undefined,
      role,
      brandId,
      password: password.trim() || undefined,
    };

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.user) {
        throw new Error(data?.error ?? t("create.errors.failed"));
      }

      onCreated(data.user as AdminUserSummary);
      setSuccess(t("create.success"));
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("create.errors.failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => {
      if (!next) {
        resetForm();
      }
      onOpenChange(next);
    }}>
      <SheetContent className="flex h-full max-w-xl flex-col p-0">
        <SheetHeader className="border-b border-slate-200 px-6 py-5 text-left">
          <SheetTitle>{t("create.title")}</SheetTitle>
          <SheetDescription>{t("create.description")}</SheetDescription>
        </SheetHeader>
        <form className="flex-1 overflow-y-auto px-6 py-6 space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="user-create-email">{t("create.fields.email")}</Label>
              <Input
                id="user-create-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("create.placeholders.email")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-create-name">{t("create.fields.name")}</Label>
              <Input
                id="user-create-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("create.placeholders.name")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-create-role">{t("create.fields.role")}</Label>
              <Select value={role} onValueChange={(value) => setRole(value as AdminUserSummary["role"])}>
                <SelectTrigger id="user-create-role" className="w-full">
                  <SelectValue placeholder={t("create.placeholders.role")} />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {rolesT(option.value as any) ?? option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-create-password">{t("create.fields.password")}</Label>
              <Input
                id="user-create-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("create.placeholders.password")}
              />
              <p className="text-xs text-slate-500">{t("create.hints.password")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-create-brand">{t("create.fields.brand")}</Label>
              <Select
                value={brandId ?? UNASSIGNED_BRAND_VALUE}
                onValueChange={(value) => setBrandId(value === UNASSIGNED_BRAND_VALUE ? null : value)}
              >
                <SelectTrigger id="user-create-brand" className="w-full">
                  <SelectValue placeholder={t("create.placeholders.brand")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED_BRAND_VALUE}>{t("create.unassigned")}</SelectItem>
                  {brandOptions.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("detail.close")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("create.submitting") : t("create.submit")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
