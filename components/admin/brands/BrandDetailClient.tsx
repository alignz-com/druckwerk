"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Plus, Search, Trash2 } from "lucide-react";

import type { AdminBrandAddress, AdminBrandSummary } from "@/lib/admin/brands-data";
import { useLocale, useTranslations } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  dataTableContainerClass,
  dataTableHeaderClass,
  dataTableRowClass,
} from "@/components/admin/shared/data-table-styles";
import { AddressSheet, type AddressSheetState, type BrandAddressDraft } from "./AddressSheet";
import BrandTemplateSection from "./BrandTemplateSection";
import { BrandAccessSection } from "./BrandAccessSection";
import { formatDateTime } from "@/lib/formatDateTime";

export type BrandDetailClientProps = {
  brand?: AdminBrandSummary | null;
};

type BrandAddressForm = BrandAddressDraft;

type BrandForm = {
  id?: string;
  name: string;
  slug: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addresses: BrandAddressForm[];
};

const emptyForm = (): BrandForm => ({
  name: "",
  slug: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  addresses: [],
});

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

export default function BrandDetailClient({ brand }: BrandDetailClientProps) {
  const router = useRouter();
  const t = useTranslations("admin.brands");
  const [brandSnapshot, setBrandSnapshot] = useState(brand);
  const { locale } = useLocale();
  const dateLocale = locale === "de" ? "de-AT" : "en-GB";
  const formatTimestamp = (value: string | Date | null | undefined) =>
    value ? formatDateTime(value, dateLocale, { dateStyle: "medium", timeStyle: "short" }) : "—";
  const mode: "create" | "edit" = brandSnapshot ? "edit" : "create";
  const [form, setForm] = useState<BrandForm>(() => (brandSnapshot ? mapBrandToForm(brandSnapshot) : emptyForm()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressSearch, setAddressSearch] = useState("");
  const [addressSheetState, setAddressSheetState] = useState<AddressSheetState | null>(null);

  useEffect(() => {
    if (brand) {
      setForm(mapBrandToForm(brand));
      setBrandSnapshot(brand);
    } else {
      setForm(emptyForm());
      setBrandSnapshot(null);
    }
  }, [brand]);

  const addressesCount = form.addresses.length;

  const headerTitle =
    mode === "create" ? t("dialog.createTitle") : t("dialog.editTitle", { name: brandSnapshot?.name ?? "" });

  const handleFieldChange = (field: keyof Omit<BrandForm, "id" | "addresses">, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openCreateAddress = () => {
    setAddressSheetState({ mode: "create", address: emptyAddress() });
  };

  const openEditAddress = (clientKey: string) => {
    const target = form.addresses.find((address) => address.clientKey === clientKey);
    if (target) {
      setAddressSheetState({ mode: "edit", address: target });
    }
  };

  const handleAddressSaved = (updatedBrand: AdminBrandSummary) => {
    setBrandSnapshot(updatedBrand);
    setForm(mapBrandToForm(updatedBrand));
    setAddressSheetState(null);
  };

  const closeAddressSheet = () => setAddressSheetState(null);

  const handleAddressDelete = async (clientKey: string) => {
    if (!brandSnapshot?.id) return;
    const confirmed = window.confirm(t("addresses.confirmDelete"));
    if (!confirmed) return;

    // clientKey === address.id for all DB-persisted addresses
    const addressId = clientKey;

    try {
      const res = await fetch(`/api/admin/brands/${brandSnapshot.id}/addresses/${addressId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.brand) {
        throw new Error(data?.error ?? "Delete failed");
      }
      const updatedBrand = data.brand as AdminBrandSummary;
      setBrandSnapshot(updatedBrand);
      setForm(mapBrandToForm(updatedBrand));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const navigateBack = () => {
    router.push("/admin/brands");
  };

  const submit = async () => {
    if (!form.name.trim()) return;
    setIsSubmitting(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() ? form.slug.trim() : undefined,
      contactName: form.contactName.trim() ? form.contactName.trim() : null,
      contactEmail: form.contactEmail.trim() ? form.contactEmail.trim() : null,
      contactPhone: form.contactPhone.trim() ? form.contactPhone.trim() : null,
    };

    try {
      if (mode === "create") {
        const response = await fetch("/api/admin/brands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = (await response.json().catch(() => ({}))) as { brandId?: string; error?: string };
        if (!response.ok) {
          throw new Error(data?.error ?? "Request failed");
        }

        setIsSubmitting(false);

        if (data.brandId) {
          router.push(`/admin/brands/${data.brandId}`);
          router.refresh();
          return;
        }

        router.push("/admin/brands");
        router.refresh();
        return;
      }

      if (form.id) {
        const response = await fetch(`/api/admin/brands/${form.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error ?? "Request failed");
        }

        router.refresh();
      }

      setIsSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setIsSubmitting(false);
    }
  };

  const deleteBrand = async () => {
    if (!brandSnapshot?.id) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/brands/${brandSnapshot.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? "Delete failed");
      }

      router.push("/admin/brands");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setIsSubmitting(false);
    }
  };

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
        address.cardAddressText,
        address.postalCode,
        address.city,
        address.countryCode,
        address.url,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedAddressSearch);
    });
  }, [form.addresses, normalizedAddressSearch]);

  const stats = useMemo(() => {
    if (!brandSnapshot) return null;
    return [
      { label: t("detail.stats.templates"), value: brandSnapshot.templateCount },
      { label: t("detail.stats.orders"), value: brandSnapshot.orderCount },
      { label: t("detail.stats.addresses"), value: addressesCount },
    ];
  }, [addressesCount, brandSnapshot, t]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex h-full flex-col"
    >
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-start gap-3">
            <Button type="button" variant="ghost" size="sm" asChild className="-ml-2">
              <Link href="/admin/brands" className="flex items-center gap-2 text-slate-600">
                <ArrowLeft className="h-4 w-4" />
                {t("detail.back")}
              </Link>
            </Button>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-slate-900">{headerTitle}</h1>
              <p className="text-sm text-slate-500">{t("dialog.description")}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={navigateBack}>
              {t("actions.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !form.name.trim()}>
              {isSubmitting ? t("actions.saving") : t("actions.save")}
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-6">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{t("detail.sections.general.title")}</h2>
              <p className="text-xs text-slate-500">{t("detail.sections.general.description")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="brand-name">{t("form.name")}</Label>
                <Input
                  id="brand-name"
                  value={form.name}
                  onChange={(event) => handleFieldChange("name", event.target.value)}
                  maxLength={200}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand-slug">{t("form.slug")}</Label>
                <Input
                  id="brand-slug"
                  value={form.slug}
                  onChange={(event) => handleFieldChange("slug", event.target.value)}
                  maxLength={200}
                />
                <p className="text-xs text-slate-500">{t("form.slugHint")}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand-contact-name">{t("form.contactName")}</Label>
                <Input
                  id="brand-contact-name"
                  value={form.contactName}
                  onChange={(event) => handleFieldChange("contactName", event.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand-contact-email">{t("form.contactEmail")}</Label>
                <Input
                  id="brand-contact-email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) => handleFieldChange("contactEmail", event.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand-contact-phone">{t("form.contactPhone")}</Label>
                <Input
                  id="brand-contact-phone"
                  value={form.contactPhone}
                  onChange={(event) => handleFieldChange("contactPhone", event.target.value)}
                  maxLength={100}
                />
              </div>
            </div>
          </section>

          {brandSnapshot ? (
            <>
              <BrandTemplateSection
                brandId={brandSnapshot.id}
                templates={brandSnapshot.templates}
                defaultTemplateId={brandSnapshot.defaultTemplateId}
                onBrandUpdated={(next) => setBrandSnapshot(next)}
              />
              <Separator />
              <BrandAccessSection
                brandId={brandSnapshot.id}
                canOrderBusinessCards={brandSnapshot.canOrderBusinessCards ?? true}
                canOrderPdfPrint={brandSnapshot.canOrderPdfPrint ?? false}
              />
              <Separator />
            </>
          ) : (
            <Separator />
          )}

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{t("detail.sections.addresses.title")}</h2>
                <p className="text-xs text-slate-500">{t("detail.sections.addresses.description")}</p>
              </div>
              <Button type="button" onClick={openCreateAddress} className="self-start sm:self-auto">
                <Plus className="mr-2 h-4 w-4" />
                {t("addresses.add")}
              </Button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={addressSearch}
                  onChange={(event) => setAddressSearch(event.target.value)}
                  placeholder={t("addresses.searchPlaceholder")}
                  className="pl-9"
                />
              </div>
            </div>
            <div className={dataTableContainerClass}>
              <Table>
                <TableHeader className={dataTableHeaderClass}>
                  <TableRow>
                    <TableHead>{t("addresses.table.columns.label")}</TableHead>
                    <TableHead>{t("addresses.table.columns.address")}</TableHead>
                    <TableHead className="w-24">{t("addresses.table.columns.country")}</TableHead>
                    <TableHead className="w-32">{t("addresses.table.columns.updated")}</TableHead>
                    <TableHead className="w-28 text-right">{t("addresses.table.columns.actions")}</TableHead>
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
                            <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{address.cardAddressText}</p>
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
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t("addresses.actions.delete")}
                              onClick={() => handleAddressDelete(address.clientKey)}
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
              <Separator />
              <section className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{t("detail.sections.metadata.title")}</h2>
                  <p className="text-xs text-slate-500">{t("detail.sections.metadata.description")}</p>
                </div>
                {stats ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {stats.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center"
                      >
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {item.label}
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {t("detail.metadata.createdAt")}
                    </span>
                    <p className="text-sm text-slate-700">{brandSnapshot ? formatTimestamp(brandSnapshot.createdAt) : "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {t("detail.metadata.updatedAt")}
                    </span>
                    <p className="text-sm text-slate-700">{brandSnapshot ? formatTimestamp(brandSnapshot.updatedAt) : "—"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t("form.slug")}
                  </span>
                      <Badge variant="outline">{brandSnapshot?.slug ?? "—"}</Badge>
                </div>
              </section>
            </>
          ) : null}

          {mode === "edit" ? (
            <>
              <Separator />
              <section>
                <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
                  <div>
                    <h2 className="text-sm font-semibold text-red-900">{t("detail.sections.danger.title")}</h2>
                    <p className="text-xs text-red-700">{t("detail.sections.danger.description")}</p>
                    <p className="text-xs text-red-700">{t("detail.sections.danger.helper")}</p>
                  </div>
                  <Button type="button" variant="destructive" onClick={deleteBrand} disabled={isSubmitting}>
                    {t("actions.delete")}
                  </Button>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </ScrollArea>
      <AddressSheet brandId={brandSnapshot?.id ?? ""} state={addressSheetState} onClose={closeAddressSheet} onSaved={handleAddressSaved} />
    </form>
  );
}

function mapAddressToForm(address: AdminBrandAddress): BrandAddressForm {
  return {
    id: address.id,
    clientKey: address.id ?? generateKey(),
    label: address.label ?? "",
    company: address.company ?? "",
    street: address.street ?? "",
    addressExtra: address.addressExtra ?? "",
    postalCode: address.postalCode ?? "",
    city: address.city ?? "",
    countryCode: address.countryCode ?? "",
    cardAddressText: address.cardAddressText ?? "",
    url: address.url ?? "",
    createdAt: address.createdAt ?? null,
    updatedAt: address.updatedAt ?? null,
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
    addresses: brand.addresses.map((address) => mapAddressToForm(address)),
  };
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
