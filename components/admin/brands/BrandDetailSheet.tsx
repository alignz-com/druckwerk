"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

import type { AdminBrandAddress, AdminBrandSummary } from "@/lib/admin/brands-data";
import { useLocale, useTranslations } from "@/components/providers/locale-provider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  dataTableContainerClass,
  dataTableHeaderClass,
  dataTableRowClass,
} from "@/components/admin/shared/data-table-styles";
import { AddressSheet, type AddressSheetState, type BrandAddressDraft } from "./address-sheet";
import BrandTemplateSection from "./BrandTemplateSection";
import { formatDateTime } from "@/lib/formatDateTime";
import { cn } from "@/lib/utils";

type Props = {
  brand: AdminBrandSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBrandUpdated: (brand: AdminBrandSummary) => void;
  onBrandDeleted: (brandId: string) => void;
};

type BrandForm = {
  id?: string;
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
  addresses: BrandAddressForm[];
};

type BrandAddressForm = BrandAddressDraft;

const generateKey = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const emptyAddress = (): BrandAddressForm => ({
  clientKey: generateKey(),
  label: "",
  company: "",
  street: "",
  addressExtra: "",
  postalCode: "",
  city: "",
  countryCode: "",
  cardAddressText: "",
  url: "",
  createdAt: null,
  updatedAt: null,
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

export default function BrandDetailSheet({
  brand: initialBrand,
  open,
  onOpenChange,
  onBrandUpdated,
  onBrandDeleted,
}: Props) {
  const t = useTranslations("admin.brands");
  const { locale } = useLocale();
  const dateLocale = locale === "de" ? "de-AT" : "en-GB";
  const formatTimestamp = (value: string | Date | null | undefined) => {
    if (!value) return "—";
    return formatDateTime(value, dateLocale, { dateStyle: "medium", timeStyle: "short" });
  };
  const [brand, setBrand] = useState(initialBrand);
  const [form, setForm] = useState<BrandForm>(() => (initialBrand ? mapBrandToForm(initialBrand) : emptyForm()));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [isDomainSubmitting, setIsDomainSubmitting] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [publicDomainInput, setPublicDomainInput] = useState("");
  const [isPublicDomainSubmitting, setIsPublicDomainSubmitting] = useState(false);
  const [publicDomainError, setPublicDomainError] = useState<string | null>(null);

  useEffect(() => {
    setBrand(initialBrand);
  }, [initialBrand]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setFeedback(null);
      setDomainError(null);
      setDomainInput("");
      setPublicDomainError(null);
      setPublicDomainInput("");
      if (!brand) {
        setForm(emptyForm());
      }
      return;
    }

    if (brand) {
      setForm(mapBrandToForm(brand));
      setError(null);
      setFeedback(null);
      setDomainError(null);
      setDomainInput("");
      setPublicDomainError(null);
      setPublicDomainInput("");
    }
  }, [open, brand]);

  const [addressSearch, setAddressSearch] = useState("");
  const [addressSheetState, setAddressSheetState] = useState<AddressSheetState | null>(null);

  const applyBrandUpdate = (updated: AdminBrandSummary) => {
    setBrand(updated);
    onBrandUpdated(updated);
  };

  const statItems =
    brand?.id
      ? [
          { label: t("detail.stats.templates"), value: brand.templateCount },
          { label: t("detail.stats.orders"), value: brand.orderCount },
          { label: t("detail.stats.addresses"), value: form.addresses.length },
        ]
      : [];

  const normalizedAddressSearch = addressSearch.trim().toLowerCase();
  const filteredAddresses = useMemo(() => {
    if (!normalizedAddressSearch) {
      return form.addresses;
    }
    return form.addresses.filter((address) => {
      const haystack = [
        address.label,
        address.company,
        address.street,
        address.addressExtra,
        address.postalCode,
        address.city,
        address.countryCode,
        address.cardAddressText,
        address.url,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedAddressSearch);
    });
  }, [form.addresses, normalizedAddressSearch]);

  const handleFieldChange = (field: keyof Omit<BrandForm, "id" | "addresses">, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openCreateAddress = () => {
    setAddressSheetState({ mode: "create", address: emptyAddress() });
  };

  const openEditAddress = (clientKey: string) => {
    const target = form.addresses.find((address) => address.clientKey === clientKey);
    if (target) {
      setAddressSheetState({ mode: "edit", address: { ...target } });
    }
  };

  const handleAddressSaved = (value: BrandAddressForm) => {
    setForm((current) => {
      const exists = current.addresses.some((address) => address.clientKey === value.clientKey);
      const addresses = exists
        ? current.addresses.map((address) => (address.clientKey === value.clientKey ? value : address))
        : [...current.addresses, value];
      return { ...current, addresses };
    });
    setAddressSheetState(null);
  };

  const closeAddressSheet = () => setAddressSheetState(null);

  const handleAddressDelete = (clientKey: string) => {
    const confirmed = window.confirm(t("addresses.confirmDelete"));
    if (!confirmed) return;
    setForm((current) => ({
      ...current,
      addresses: current.addresses.filter((address) => address.clientKey !== clientKey),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!brand?.id) return;
    if (!form.name.trim()) return;

    setIsSaving(true);
    setError(null);
    setFeedback(null);

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
      setIsSaving(false);
      return;
    }
    if (
      quantityMinResult.value !== null &&
      quantityMaxResult.value !== null &&
      quantityMaxResult.value < quantityMinResult.value
    ) {
      setError(t("form.quantityRangeInvalid"));
      setIsSaving(false);
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
      addresses: form.addresses.map((address) => ({
        id: address.id,
        label: address.label.trim() ? address.label.trim() : null,
        company: address.company.trim() ? address.company.trim() : null,
        street: address.street.trim() ? address.street.trim() : null,
        addressExtra: address.addressExtra.trim() ? address.addressExtra.trim() : null,
        postalCode: address.postalCode.trim() ? address.postalCode.trim() : null,
        city: address.city.trim() ? address.city.trim() : null,
        countryCode: address.countryCode.trim() ? address.countryCode.trim().toUpperCase() : null,
        cardAddressText: address.cardAddressText.trim() ? address.cardAddressText.trim() : null,
        url: address.url.trim() ? address.url.trim() : null,
      })),
    };

    try {
      const response = await fetch(`/api/admin/brands/${brand.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.brand) {
        throw new Error(data?.error ?? t("toast.updateFailed"));
      }

      const updatedBrand = data.brand as AdminBrandSummary;
      setForm(mapBrandToForm(updatedBrand));
      applyBrandUpdate(updatedBrand);
      setFeedback(t("toast.updated", { name: updatedBrand.name }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("toast.updateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!brand?.id) return;
    const confirmed = window.confirm(t("confirmDelete", { name: brand.name }));
    if (!confirmed) return;

    setIsSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/brands/${brand.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? t("toast.deleteFailed"));
      }

      onOpenChange(false);
      onBrandDeleted(brand.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("toast.deleteFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const submitDomain = async () => {
    if (!brand?.id) return;
    const value = domainInput.trim().toLowerCase();
    if (!value) return;

    setIsDomainSubmitting(true);
    setDomainError(null);

    try {
      const response = await fetch(`/api/admin/brands/${brand.id}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.brand) {
        throw new Error(data?.error ?? t("domains.errors.createFailed"));
      }

      const updatedBrand = data.brand as AdminBrandSummary;
      applyBrandUpdate(updatedBrand);
      setForm(mapBrandToForm(updatedBrand));
      setFeedback(t("domains.success.added", { domain: value }));
      setDomainInput("");
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : t("domains.errors.createFailed"));
    } finally {
      setIsDomainSubmitting(false);
    }
  };

  const removeDomain = async (domainId: string) => {
    if (!brand?.id) return;

    setIsDomainSubmitting(true);
    setDomainError(null);

    try {
      const response = await fetch(`/api/admin/brands/${brand.id}/domains`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.brand) {
        throw new Error(data?.error ?? t("domains.errors.deleteFailed"));
      }

      const updatedBrand = data.brand as AdminBrandSummary;
      applyBrandUpdate(updatedBrand);
      setForm(mapBrandToForm(updatedBrand));
      setFeedback(t("domains.success.removed"));
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : t("domains.errors.deleteFailed"));
    } finally {
      setIsDomainSubmitting(false);
    }
  };

  const disableActions = isSaving || isDomainSubmitting || isPublicDomainSubmitting;
  const disablePublicDomainActions = isSaving || isPublicDomainSubmitting;

  const submitPublicDomain = async () => {
    if (!brand?.id) return;
    const value = publicDomainInput.trim().toLowerCase();
    if (!value) return;

    setIsPublicDomainSubmitting(true);
    setPublicDomainError(null);
    try {
      const response = await fetch(`/api/admin/brands/${brand.id}/public-domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.brand) {
        throw new Error(data?.error ?? t("publicDomains.errors.createFailed"));
      }

      const updatedBrand = data.brand as AdminBrandSummary;
      applyBrandUpdate(updatedBrand);
      setForm(mapBrandToForm(updatedBrand));
      setFeedback(t("publicDomains.success.added", { domain: value }));
      setPublicDomainInput("");
    } catch (err) {
      setPublicDomainError(err instanceof Error ? err.message : t("publicDomains.errors.createFailed"));
    } finally {
      setIsPublicDomainSubmitting(false);
    }
  };

  const removePublicDomain = async (domainId: string) => {
    if (!brand?.id) return;

    setIsPublicDomainSubmitting(true);
    setPublicDomainError(null);
    try {
      const response = await fetch(`/api/admin/brands/${brand.id}/public-domains`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.brand) {
        throw new Error(data?.error ?? t("publicDomains.errors.deleteFailed"));
      }

      const updatedBrand = data.brand as AdminBrandSummary;
      applyBrandUpdate(updatedBrand);
      setForm(mapBrandToForm(updatedBrand));
      setFeedback(t("publicDomains.success.removed"));
    } catch (err) {
      setPublicDomainError(err instanceof Error ? err.message : t("publicDomains.errors.deleteFailed"));
    } finally {
      setIsPublicDomainSubmitting(false);
    }
  };

  const setPrimaryPublicDomain = async (domainId: string) => {
    if (!brand?.id) return;

    setIsPublicDomainSubmitting(true);
    setPublicDomainError(null);
    try {
      const response = await fetch(`/api/admin/brands/${brand.id}/public-domains`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.brand) {
        throw new Error(data?.error ?? t("publicDomains.errors.updateFailed"));
      }

      const updatedBrand = data.brand as AdminBrandSummary;
      applyBrandUpdate(updatedBrand);
      setForm(mapBrandToForm(updatedBrand));
      setFeedback(t("publicDomains.success.updated"));
    } catch (err) {
      setPublicDomainError(err instanceof Error ? err.message : t("publicDomains.errors.updateFailed"));
    } finally {
      setIsPublicDomainSubmitting(false);
    }
  };

  const handleSheetOpenChange = (next: boolean) => {
    if (!next && disableActions) {
      return;
    }
    onOpenChange(next);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="flex h-full max-w-4xl flex-col p-0">
          {brand ? (
            <>
              <SheetHeader className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-5 text-left">
                <SheetTitle>{brand.name}</SheetTitle>
                <SheetDescription>{t("dialog.description")}</SheetDescription>
              </SheetHeader>
              <form onSubmit={handleSubmit} className="flex h-full flex-col">
                <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
                  <div className="w-full space-y-8">
                  {error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  ) : null}
                  {feedback ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {feedback}
                    </div>
                  ) : null}

                  {statItems.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {statItems.map((item) => (
                        <Card key={item.label}>
                          <CardHeader className="pb-2">
                            <CardDescription>{item.label}</CardDescription>
                            <CardTitle className="text-2xl">{item.value}</CardTitle>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  ) : null}

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{t("detail.sections.general.title")}</h3>
          <p className="text-xs text-slate-500">{t("detail.sections.general.description")}</p>
        </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="brand-name-detail">{t("form.name")}</Label>
                        <Input
                          id="brand-name-detail"
                          value={form.name}
                          onChange={(event) => handleFieldChange("name", event.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="brand-slug-detail">{t("form.slug")}</Label>
                        <Input
                          id="brand-slug-detail"
                          value={form.slug}
                          onChange={(event) => handleFieldChange("slug", event.target.value)}
                        />
                        <p className="text-xs text-slate-500">{t("form.slugHint")}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="brand-contact-name-detail">{t("form.contactName")}</Label>
                        <Input
                          id="brand-contact-name-detail"
                          value={form.contactName}
                          onChange={(event) => handleFieldChange("contactName", event.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="brand-contact-email-detail">{t("form.contactEmail")}</Label>
                        <Input
                          id="brand-contact-email-detail"
                          type="email"
                          value={form.contactEmail}
                          onChange={(event) => handleFieldChange("contactEmail", event.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="brand-contact-phone-detail">{t("form.contactPhone")}</Label>
                        <Input
                          id="brand-contact-phone-detail"
                          value={form.contactPhone}
                          onChange={(event) => handleFieldChange("contactPhone", event.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="brand-logo-url-detail">{t("form.logoUrl")}</Label>
                        <Input
                          id="brand-logo-url-detail"
                          value={form.logoUrl}
                          onChange={(event) => handleFieldChange("logoUrl", event.target.value)}
                          placeholder={t("form.logoUrlPlaceholder")}
                        />
                        <p className="text-xs text-slate-500">{t("form.logoUrlHint")}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="brand-qr-mode-detail">{t("form.qrMode")}</Label>
                        <select
                          id="brand-qr-mode-detail"
                          value={form.qrMode}
                          onChange={(event) => handleFieldChange("qrMode", event.target.value)}
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
                      <div className="space-y-1.5">
                        <Label htmlFor="brand-default-qr-mode-detail">{t("form.defaultQrMode")}</Label>
                        <select
                          id="brand-default-qr-mode-detail"
                          value={form.defaultQrMode}
                          onChange={(event) => handleFieldChange("defaultQrMode", event.target.value)}
                          className={cn(
                            "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700",
                            "focus:outline-none focus:ring-2 focus:ring-slate-400",
                          )}
                          disabled={form.qrMode !== "BOTH"}
                        >
                          <option value="VCARD_ONLY">{t("form.qrModes.vcard")}</option>
                          <option value="PUBLIC_PROFILE_ONLY">{t("form.qrModes.public")}</option>
                        </select>
                        {form.qrMode !== "BOTH" ? (
                          <p className="text-xs text-slate-500">{t("form.defaultQrModeHint")}</p>
                        ) : null}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="brand-quantity-min">{t("form.quantityMin")}</Label>
                        <Input
                          id="brand-quantity-min"
                          inputMode="numeric"
                          value={form.quantityMin}
                          onChange={(event) => handleFieldChange("quantityMin", event.target.value)}
                          placeholder="50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="brand-quantity-max">{t("form.quantityMax")}</Label>
                        <Input
                          id="brand-quantity-max"
                          inputMode="numeric"
                          value={form.quantityMax}
                          onChange={(event) => handleFieldChange("quantityMax", event.target.value)}
                          placeholder="1000"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="brand-quantity-step">{t("form.quantityStep")}</Label>
                        <Input
                          id="brand-quantity-step"
                          inputMode="numeric"
                          value={form.quantityStep}
                          onChange={(event) => handleFieldChange("quantityStep", event.target.value)}
                          placeholder="50"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="brand-quantity-options">{t("form.quantityOptions")}</Label>
                        <Input
                          id="brand-quantity-options"
                          value={form.quantityOptions}
                          onChange={(event) => handleFieldChange("quantityOptions", event.target.value)}
                          placeholder="50, 100, 250"
                        />
                        <p className="text-xs text-slate-500">{t("form.quantityOptionsHint")}</p>
                      </div>
        </div>
      </section>

                  <Separator />

                  <section className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{t("detail.sections.addresses.title")}</h3>
                      <p className="text-xs text-slate-500">{t("detail.sections.addresses.description")}</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="relative w-full sm:max-w-xs">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={addressSearch}
                          onChange={(event) => setAddressSearch(event.target.value)}
                          placeholder={t("addresses.searchPlaceholder")}
                          className="pl-9"
                        />
                      </div>
                      <Button type="button" onClick={openCreateAddress} disabled={disableActions} className="self-end sm:self-auto">
                        <Plus className="mr-2 h-4 w-4" />
                        {t("addresses.add")}
                      </Button>
                    </div>
                    <div className={cn(dataTableContainerClass, "mt-4")}>
                      <Table>
                        <TableHeader className={dataTableHeaderClass}>
                          <TableRow>
                            <TableHead>{t("addresses.table.columns.label")}</TableHead>
                            <TableHead>{t("addresses.table.columns.address")}</TableHead>
                            <TableHead className="w-24">{t("addresses.table.columns.country")}</TableHead>
                            <TableHead className="w-32">{t("addresses.table.columns.updated")}</TableHead>
                            <TableHead className="w-24 text-right">{t("addresses.table.columns.actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAddresses.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="py-6 text-center text-sm text-slate-500">
                                {addressSearch ? t("addresses.noResults") : t("addresses.empty")}
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredAddresses.map((address) => (
                              <TableRow key={address.clientKey} className={dataTableRowClass}>
                                <TableCell className="align-top">
                                  <div className="font-medium text-slate-900">
                                    {address.label || t("addresses.fields.label")}
                                  </div>
                                  <div className="text-sm text-slate-500">{address.company || "—"}</div>
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="text-sm text-slate-700">{formatAddressPreview(address)}</div>
                                  {address.cardAddressText ? (
                                    <p className="mt-1 text-xs text-slate-500 whitespace-pre-line">
                                      {address.cardAddressText}
                                    </p>
                                  ) : null}
                                </TableCell>
                                <TableCell className="align-top text-sm text-slate-600">
                                  {address.countryCode ? address.countryCode.toUpperCase() : "—"}
                                </TableCell>
                                <TableCell className="align-top text-sm text-slate-600">
                                  {formatTimestamp(address.updatedAt)}
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      aria-label={t("addresses.actions.edit")}
                                      onClick={() => openEditAddress(address.clientKey)}
                                      disabled={disableActions}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      aria-label={t("addresses.actions.delete")}
                                      onClick={() => handleAddressDelete(address.clientKey)}
                                      disabled={disableActions}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
          </section>

          {brand ? (
            <>
              <BrandTemplateSection
                brandId={brand.id}
                templates={brand.templates}
                defaultTemplateId={brand.defaultTemplateId}
                onBrandUpdated={applyBrandUpdate}
              />
              <Separator />
            </>
          ) : (
            <Separator />
          )}

          <section className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{t("domains.title")}</h3>
                      <p className="text-xs text-slate-500">{t("domains.description")}</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
                      <Input
                        value={domainInput}
                        onChange={(event) => setDomainInput(event.target.value)}
                        placeholder={t("domains.placeholder")}
                        className="w-full"
                      />
                      <Button
                        type="button"
                        onClick={submitDomain}
                        disabled={disableActions || !domainInput.trim()}
                        className="sm:w-auto"
                      >
                        {isDomainSubmitting ? t("domains.saving") : t("domains.add")}
                      </Button>
                    </div>
                    {domainError ? <p className="text-sm text-red-600">{domainError}</p> : null}
                    {brand.domains.length === 0 ? (
                      <p className="text-sm text-slate-500">{t("domains.empty")}</p>
                    ) : (
                      <ul className="flex flex-wrap gap-2 text-sm text-slate-600">
                        {brand.domains.map((domain) => (
                          <li
                            key={domain.id}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1"
                          >
                            <span>{domain.domain}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              disabled={disableActions}
                              onClick={() => removeDomain(domain.id)}
                              aria-label={t("domains.removeLabel", { domain: domain.domain })}
                            >
                              ×
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <Separator />

                  <section className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{t("publicDomains.title")}</h3>
                      <p className="text-xs text-slate-500">{t("publicDomains.description")}</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
                      <Input
                        value={publicDomainInput}
                        onChange={(event) => setPublicDomainInput(event.target.value)}
                        placeholder={t("publicDomains.placeholder")}
                        className="w-full"
                      />
                      <Button
                        type="button"
                        onClick={submitPublicDomain}
                        disabled={disablePublicDomainActions || !publicDomainInput.trim()}
                        className="sm:w-auto"
                      >
                        {isPublicDomainSubmitting ? t("publicDomains.saving") : t("publicDomains.add")}
                      </Button>
                    </div>
                    {publicDomainError ? <p className="text-sm text-red-600">{publicDomainError}</p> : null}
                    {brand.publicDomains.length === 0 ? (
                      <p className="text-sm text-slate-500">{t("publicDomains.empty")}</p>
                    ) : (
                      <ul className="space-y-2 text-sm text-slate-600">
                        {brand.publicDomains.map((domain) => (
                          <li
                            key={domain.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{domain.domain}</span>
                              {domain.isPrimary ? (
                                <Badge variant="outline">{t("publicDomains.primary")}</Badge>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              {!domain.isPrimary ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={disablePublicDomainActions}
                                  onClick={() => setPrimaryPublicDomain(domain.id)}
                                >
                                  {t("publicDomains.setPrimary")}
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={disablePublicDomainActions}
                                onClick={() => removePublicDomain(domain.id)}
                                aria-label={t("publicDomains.removeLabel", { domain: domain.domain })}
                              >
                                ×
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <Separator />

                  <section className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{t("detail.sections.metadata.title")}</h3>
                      <p className="text-xs text-slate-500">{t("detail.sections.metadata.description")}</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {t("detail.metadata.createdAt")}
                        </span>
                        <p className="text-sm text-slate-700">{formatTimestamp(brand.createdAt)}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {t("detail.metadata.updatedAt")}
                        </span>
                        <p className="text-sm text-slate-700">{formatTimestamp(brand.updatedAt)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {t("form.slug")}
                      </span>
                      <Badge variant="outline">{brand.slug}</Badge>
                    </div>
                  </section>

                  <Separator />

                  <section>
                    <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold text-red-900">{t("detail.sections.danger.title")}</h3>
                        <p className="text-xs text-red-700">{t("detail.sections.danger.description")}</p>
                        <p className="text-xs text-red-700">{t("detail.sections.danger.helper")}</p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={disableActions}
                        className="self-start"
                      >
                        {t("actions.delete")}
                      </Button>
                    </div>
                  </section>
                  </div>
                </div>
              <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 px-6 py-4 sm:flex sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={disableActions}
                >
                  {t("actions.cancel")}
                </Button>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button type="submit" disabled={disableActions || !form.name.trim()}>
                    {isSaving ? t("actions.saving") : t("actions.save")}
                  </Button>
                </div>
              </div>
              </form>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
      <AddressSheet state={addressSheetState} onClose={closeAddressSheet} onSave={handleAddressSaved} />
    </>
  );
}

function formatAddressPreview(address: BrandAddressForm) {
  const parts = [
    address.street,
    address.addressExtra,
    [address.postalCode, address.city].filter(Boolean).join(" ").trim(),
    address.url ?? "",
  ].filter((value) => value && value.trim().length > 0);

  return parts.length > 0 ? parts.join(" · ") : "—";
}

function emptyForm(): BrandForm {
  return {
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
    addresses: [],
  };
}

function mapBrandToForm(brand: AdminBrandSummary): BrandForm {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    contactName: brand.contactName ?? "",
    contactEmail: brand.contactEmail ?? "",
    contactPhone: brand.contactPhone ?? "",
    logoUrl: brand.logoUrl ?? "",
    qrMode: (brand.qrMode as BrandForm["qrMode"]) ?? "VCARD_ONLY",
    defaultQrMode: (brand.defaultQrMode as BrandForm["defaultQrMode"]) ?? "",
    quantityMin: brand.quantityMin ? String(brand.quantityMin) : "",
    quantityMax: brand.quantityMax ? String(brand.quantityMax) : "",
    quantityStep: brand.quantityStep ? String(brand.quantityStep) : "",
    quantityOptions: brand.quantityOptions?.length ? brand.quantityOptions.join(", ") : "",
    addresses: brand.addresses.map((address) => mapAddress(address)),
  };
}

function mapAddress(address: AdminBrandAddress): BrandAddressForm {
  return {
    id: address.id,
    clientKey: address.id ?? generateKey(),
    label: address.label ?? "",
    company: address.company ?? "",
    street: address.street ?? "",
    addressExtra: address.addressExtra ?? "",
    cardAddressText: address.cardAddressText ?? "",
    postalCode: address.postalCode ?? "",
    city: address.city ?? "",
    countryCode: address.countryCode ?? "",
    url: address.url ?? "",
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  };
}
