"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/components/providers/locale-provider";
import type { AdminBrandSummary } from "@/lib/admin/brands-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  dataTableContainerClass,
  dataTableHeaderClass,
  dataTableRowClass,
} from "@/components/admin/shared/data-table-styles";
import { AddressSheet, type AddressSheetState, type BrandAddressDraft } from "./address-sheet";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBrandCreated: (brand: AdminBrandSummary) => void;
};

type AddressForm = BrandAddressDraft;

type FormState = {
  name: string;
  slug: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addresses: AddressForm[];
};

const generateKey = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const emptyAddress = (): AddressForm => ({
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

const emptyForm = (): FormState => ({
  name: "",
  slug: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  addresses: [],
});

export default function BrandCreateSheet({ open, onOpenChange, onBrandCreated }: Props) {
  const t = useTranslations("admin.brands");
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [domains, setDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressSearch, setAddressSearch] = useState("");
  const [addressSheetState, setAddressSheetState] = useState<AddressSheetState | null>(null);

  const addressesCount = form.addresses.length;

  const reset = () => {
    setForm(emptyForm());
    setDomains([]);
    setDomainInput("");
    setIsSubmitting(false);
    setError(null);
  };

  const handleFieldChange = (field: keyof Omit<FormState, "addresses">, value: string) => {
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

  const handleAddressSaved = (draft: AddressForm) => {
    setForm((current) => {
      const exists = current.addresses.some((address) => address.clientKey === draft.clientKey);
      const addresses = exists
        ? current.addresses.map((address) => (address.clientKey === draft.clientKey ? draft : address))
        : [...current.addresses, draft];
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

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() ? form.slug.trim() : undefined,
      contactName: form.contactName.trim() ? form.contactName.trim() : null,
      contactEmail: form.contactEmail.trim() ? form.contactEmail.trim() : null,
      contactPhone: form.contactPhone.trim() ? form.contactPhone.trim() : null,
      addresses: form.addresses.map((address) => ({
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

      reset();
      onOpenChange(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : t("toast.createFailed"));
      setIsSubmitting(false);
    }
  };

  const normalizedAddressSearch = addressSearch.trim().toLowerCase();
  const addressRows = useMemo(() => {
    if (!normalizedAddressSearch) return form.addresses;
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

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            reset();
          }
          onOpenChange(next);
        }}
      >
      <SheetContent className="flex h-full max-w-4xl flex-col p-0">
        <SheetHeader className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-5 text-left">
          <SheetTitle>{t("dialog.createTitle")}</SheetTitle>
          <SheetDescription>{t("dialog.description")}</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{t("detail.sections.general.title")}</h3>
              <p className="text-xs text-slate-500">{t("detail.sections.general.description")}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="brand-name">{t("form.name")}</Label>
                <Input
                  id="brand-name"
                  value={form.name}
                  onChange={(event) => handleFieldChange("name", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand-slug">{t("form.slug")}</Label>
                <Input
                  id="brand-slug"
                  value={form.slug}
                  onChange={(event) => handleFieldChange("slug", event.target.value)}
                  placeholder={t("form.slugHint")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand-contact-name">{t("form.contactName")}</Label>
                <Input
                  id="brand-contact-name"
                  value={form.contactName}
                  onChange={(event) => handleFieldChange("contactName", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand-contact-email">{t("form.contactEmail")}</Label>
                <Input
                  id="brand-contact-email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) => handleFieldChange("contactEmail", event.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="brand-contact-phone">{t("form.contactPhone")}</Label>
                <Input
                  id="brand-contact-phone"
                  value={form.contactPhone}
                  onChange={(event) => handleFieldChange("contactPhone", event.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{t("detail.sections.addresses.title")}</h3>
                <p className="text-xs text-slate-500">{t("detail.sections.addresses.description")}</p>
              </div>
              <Button type="button" onClick={openCreateAddress} className="self-start sm:self-auto">
                <Plus className="mr-2 h-4 w-4" />
                {t("addresses.add")}
              </Button>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={addressSearch}
                onChange={(event) => setAddressSearch(event.target.value)}
                placeholder={t("addresses.searchPlaceholder")}
                className="pl-9"
              />
            </div>
            <div className={cn(dataTableContainerClass, "mt-4")}>
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
                  {addressRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-slate-500">
                        {addressSearch ? t("addresses.noResults") : t("addresses.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    addressRows.map((address) => (
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
                        <TableCell className="align-top text-sm text-slate-600">—</TableCell>
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

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{t("domains.title")}</h3>
                <p className="text-xs text-slate-500">{t("domains.description")}</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={domainInput}
                  onChange={(event) => setDomainInput(event.target.value)}
                  placeholder={t("domains.placeholder")}
                  className="w-56"
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

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
          <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-slate-200 bg-white/95 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("actions.saving") : t("actions.save")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
      <AddressSheet state={addressSheetState} onClose={closeAddressSheet} onSave={handleAddressSaved} />
    </>
  );
}

function formatAddressPreview(address: AddressForm) {
  const parts = [
    address.street,
    address.addressExtra,
    [address.postalCode, address.city].filter(Boolean).join(" ").trim(),
    address.url,
  ].filter((value) => value && value.trim().length > 0);

  return parts.length > 0 ? parts.join(" · ") : "—";
}
