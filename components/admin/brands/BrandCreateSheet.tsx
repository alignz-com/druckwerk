"use client";

import { useState } from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/components/providers/locale-provider";
import type { AdminBrandSummary } from "@/lib/admin/brands-data";
import { cn } from "@/lib/utils";
import LogoUpload from "./LogoUpload";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBrandCreated: (brand: AdminBrandSummary) => void;
};

type FormState = {
  name: string;
  slug: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl: string;
  qrMode: "VCARD_ONLY" | "PUBLIC_PROFILE_ONLY" | "BOTH";
  defaultQrMode: "VCARD_ONLY" | "PUBLIC_PROFILE_ONLY" | "";
  quantityMin: string;
  quantityMax: string;
  quantityStep: string;
  quantityOptions: string;
};

const emptyForm = (): FormState => ({
  name: "",
  slug: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  logoUrl: "",
  qrMode: "VCARD_ONLY",
  defaultQrMode: "",
  quantityMin: "",
  quantityMax: "",
  quantityStep: "",
  quantityOptions: "",
});

const parseOptionalPositiveInt = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return { value: null as number | null, error: null as string | null };
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { value: null as number | null, error: "invalid" };
  }
  return { value: parsed, error: null as string | null };
};

const parseQuantityOptionsInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return { value: null as number[] | null, error: null as string | null };
  const parts = trimmed.split(/[,\s]+/).filter(Boolean);
  const parsed = parts.map((part) => Number.parseInt(part, 10));
  if (parsed.some((entry) => !Number.isFinite(entry) || entry <= 0)) {
    return { value: null as number[] | null, error: "invalid" };
  }
  const unique = Array.from(new Set(parsed));
  unique.sort((a, b) => a - b);
  return { value: unique.length > 0 ? unique : null, error: null as string | null };
};

export default function BrandCreateSheet({ open, onOpenChange, onBrandCreated }: Props) {
  const t = useTranslations("admin.brands");
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [domains, setDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setForm(emptyForm());
    setDomains([]);
    setDomainInput("");
    setIsSubmitting(false);
    setError(null);
  };

  const handleFieldChange = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const addDomain = () => {
    const value = domainInput.trim().toLowerCase();
    if (!value) return;
    setDomains((current) => (current.includes(value) ? current : [...current, value]));
    setDomainInput("");
  };

  const removeDomain = (domain: string) => {
    setDomains((current) => current.filter((item) => item !== domain));
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const quantityMinResult = parseOptionalPositiveInt(form.quantityMin);
    const quantityMaxResult = parseOptionalPositiveInt(form.quantityMax);
    const quantityStepResult = parseOptionalPositiveInt(form.quantityStep);
    const quantityOptionsResult = parseQuantityOptionsInput(form.quantityOptions);

    if (
      quantityMinResult.error ||
      quantityMaxResult.error ||
      quantityStepResult.error ||
      quantityOptionsResult.error
    ) {
      setError(t("form.quantityInvalid"));
      setIsSubmitting(false);
      return;
    }
    if (
      quantityMinResult.value !== null &&
      quantityMaxResult.value !== null &&
      quantityMaxResult.value < quantityMinResult.value
    ) {
      setError(t("form.quantityRangeInvalid"));
      setIsSubmitting(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() ? form.slug.trim() : undefined,
      contactName: form.contactName.trim() ? form.contactName.trim() : null,
      contactEmail: form.contactEmail.trim() ? form.contactEmail.trim() : null,
      contactPhone: form.contactPhone.trim() ? form.contactPhone.trim() : null,
      logoUrl: form.logoUrl.trim() ? form.logoUrl.trim() : null,
      qrMode: form.qrMode,
      defaultQrMode: form.qrMode === "BOTH" ? (form.defaultQrMode || "VCARD_ONLY") : null,
      quantityMin: quantityMinResult.value,
      quantityMax: quantityMaxResult.value,
      quantityStep: quantityStepResult.value,
      quantityOptions: quantityOptionsResult.value,
    };

    try {
      const response = await fetch("/api/admin/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.brandId) {
        throw new Error(data?.error ?? t("toast.createFailed"));
      }

      let brand: AdminBrandSummary | null = data?.brand ?? null;

      if (!brand) {
        const detailRes = await fetch(`/api/admin/brands/${data.brandId}`);
        const detailJson = await detailRes.json().catch(() => ({}));
        if (detailRes.ok && detailJson?.brand) {
          brand = detailJson.brand as AdminBrandSummary;
        }
      }

      if (domains.length > 0) {
        for (const domain of domains) {
          const domainRes = await fetch(`/api/admin/brands/${data.brandId}/domains`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain }),
          });
          const domainJson = await domainRes.json().catch(() => ({}));
          if (!domainRes.ok) {
            throw new Error(domainJson?.error ?? t("domains.errors.createFailed"));
          }
          if (domainJson?.brand) {
            brand = domainJson.brand as AdminBrandSummary;
          }
        }
      }

      if (brand) {
        onBrandCreated(brand);
      }

      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("toast.createFailed"));
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent className="flex h-full max-w-4xl flex-col p-0">
        <SheetHeader className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-5 text-left">
          <SheetTitle>{t("dialog.createTitle")}</SheetTitle>
          <SheetDescription>{t("dialog.description")}</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

            {/* General */}
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{t("detail.sections.general.title")}</h3>
                <p className="text-xs text-slate-500">{t("detail.sections.general.description")}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="create-brand-name">{t("form.name")}</Label>
                  <Input
                    id="create-brand-name"
                    value={form.name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-brand-slug">{t("form.slug")}</Label>
                  <Input
                    id="create-brand-slug"
                    value={form.slug}
                    onChange={(e) => handleFieldChange("slug", e.target.value)}
                    placeholder={t("form.slugHint")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-contact-name">{t("form.contactName")}</Label>
                  <Input
                    id="create-contact-name"
                    value={form.contactName}
                    onChange={(e) => handleFieldChange("contactName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-contact-email">{t("form.contactEmail")}</Label>
                  <Input
                    id="create-contact-email"
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => handleFieldChange("contactEmail", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-contact-phone">{t("form.contactPhone")}</Label>
                  <Input
                    id="create-contact-phone"
                    value={form.contactPhone}
                    onChange={(e) => handleFieldChange("contactPhone", e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <LogoUpload
                    label={t("form.logoUrl")}
                    hint={t("form.logoUrlHint")}
                    value={form.logoUrl}
                    onChange={(url) => handleFieldChange("logoUrl", url)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-qr-mode">{t("form.qrMode")}</Label>
                  <select
                    id="create-qr-mode"
                    value={form.qrMode}
                    onChange={(e) => handleFieldChange("qrMode", e.target.value)}
                    className={cn(
                      "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700",
                      "focus:outline-none focus:ring-2 focus:ring-slate-400",
                    )}
                  >
                    <option value="VCARD_ONLY">{t("form.qrModes.vcard")}</option>
                    <option value="PUBLIC_PROFILE_ONLY">{t("form.qrModes.public")}</option>
                    <option value="BOTH">{t("form.qrModes.both")}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-default-qr-mode">{t("form.defaultQrMode")}</Label>
                  <select
                    id="create-default-qr-mode"
                    value={form.defaultQrMode}
                    onChange={(e) => handleFieldChange("defaultQrMode", e.target.value)}
                    disabled={form.qrMode !== "BOTH"}
                    className={cn(
                      "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700",
                      "focus:outline-none focus:ring-2 focus:ring-slate-400",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  >
                    <option value="VCARD_ONLY">{t("form.qrModes.vcard")}</option>
                    <option value="PUBLIC_PROFILE_ONLY">{t("form.qrModes.public")}</option>
                  </select>
                  {form.qrMode !== "BOTH" ? (
                    <p className="text-xs text-slate-500">{t("form.defaultQrModeHint")}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-quantity-min">{t("form.quantityMin")}</Label>
                  <Input
                    id="create-quantity-min"
                    inputMode="numeric"
                    value={form.quantityMin}
                    onChange={(e) => handleFieldChange("quantityMin", e.target.value)}
                    placeholder="50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-quantity-max">{t("form.quantityMax")}</Label>
                  <Input
                    id="create-quantity-max"
                    inputMode="numeric"
                    value={form.quantityMax}
                    onChange={(e) => handleFieldChange("quantityMax", e.target.value)}
                    placeholder="1000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-quantity-step">{t("form.quantityStep")}</Label>
                  <Input
                    id="create-quantity-step"
                    inputMode="numeric"
                    value={form.quantityStep}
                    onChange={(e) => handleFieldChange("quantityStep", e.target.value)}
                    placeholder="50"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="create-quantity-options">{t("form.quantityOptions")}</Label>
                  <Input
                    id="create-quantity-options"
                    value={form.quantityOptions}
                    onChange={(e) => handleFieldChange("quantityOptions", e.target.value)}
                    placeholder="50, 100, 250"
                  />
                  <p className="text-xs text-slate-500">{t("form.quantityOptionsHint")}</p>
                </div>
              </div>
            </section>

            {/* Domains */}
            <section className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{t("domains.title")}</h3>
                  <p className="text-xs text-slate-500">{t("domains.description")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Input
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDomain())}
                    placeholder={t("domains.placeholder")}
                    className="w-48"
                  />
                  <Button type="button" variant="secondary" onClick={addDomain} disabled={isSubmitting}>
                    {t("domains.add")}
                  </Button>
                </div>
              </div>
              {domains.length === 0 ? (
                <p className="text-xs text-slate-500">{t("domains.empty")}</p>
              ) : (
                <ul className="flex flex-wrap gap-2 text-xs text-slate-600">
                  {domains.map((domain) => (
                    <li
                      key={domain}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1"
                    >
                      <span>{domain}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        type="button"
                        onClick={() => removeDomain(domain)}
                        aria-label={t("domains.removeLabel", { domain })}
                      >
                        ×
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Addresses note */}
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              {t("addresses.empty")} {t("detail.sections.addresses.description")}
            </p>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            {isSubmitting ? (
              <Button key="submitting" type="button" disabled>
                {t("actions.creating")}
              </Button>
            ) : (
              <Button key="idle" type="submit" disabled={!form.name.trim()}>
                {t("actions.create")}
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
