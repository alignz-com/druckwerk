"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

import type { AdminBrandAddress, AdminBrandSummary } from "@/lib/admin/brands-data";
import { useTranslations } from "@/components/providers/locale-provider";
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
  addresses: BrandAddressForm[];
};

type BrandAddressForm = {
  id?: string;
  clientKey: string;
  label: string;
  company: string;
  street: string;
  addressExtra: string;
  postalCode: string;
  city: string;
  countryCode: string;
  cardAddressText: string;
  url: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type AddressSheetState = {
  mode: "create" | "edit";
  address: BrandAddressForm;
};

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

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function BrandDetailSheet({
  brand,
  open,
  onOpenChange,
  onBrandUpdated,
  onBrandDeleted,
}: Props) {
  const t = useTranslations("admin.brands");
  const [form, setForm] = useState<BrandForm>(() => (brand ? mapBrandToForm(brand) : emptyForm()));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [isDomainSubmitting, setIsDomainSubmitting] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setFeedback(null);
      setDomainError(null);
      setDomainInput("");
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
    }
  }, [open, brand]);

  const [addressSearch, setAddressSearch] = useState("");
  const [addressSheetState, setAddressSheetState] = useState<AddressSheetState | null>(null);

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

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (!brand?.id) return;
    if (!form.name.trim()) return;

    setIsSaving(true);
    setError(null);
    setFeedback(null);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() ? form.slug.trim() : undefined,
      contactName: form.contactName.trim() ? form.contactName.trim() : null,
      contactEmail: form.contactEmail.trim() ? form.contactEmail.trim() : null,
      contactPhone: form.contactPhone.trim() ? form.contactPhone.trim() : null,
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
      onBrandUpdated(updatedBrand);
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
      onBrandUpdated(updatedBrand);
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
      onBrandUpdated(updatedBrand);
      setForm(mapBrandToForm(updatedBrand));
      setFeedback(t("domains.success.removed"));
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : t("domains.errors.deleteFailed"));
    } finally {
      setIsDomainSubmitting(false);
    }
  };

  const disableActions = isSaving || isDomainSubmitting;

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
                    <div className={dataTableContainerClass}>
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
                                  {address.updatedAt ? dateFormatter.format(new Date(address.updatedAt)) : "—"}
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

                  <Separator />

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
                      <h3 className="text-sm font-semibold text-slate-900">{t("detail.sections.metadata.title")}</h3>
                      <p className="text-xs text-slate-500">{t("detail.sections.metadata.description")}</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {t("detail.metadata.createdAt")}
                        </span>
                        <p className="text-sm text-slate-700">{dateFormatter.format(new Date(brand.createdAt))}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {t("detail.metadata.updatedAt")}
                        </span>
                        <p className="text-sm text-slate-700">{dateFormatter.format(new Date(brand.updatedAt))}</p>
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
                  {t("actions.close")}
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
      <AddressSheet state={addressSheetState} onClose={closeAddressSheet} onSave={handleAddressSaved} t={t} />
    </>
  );
}

type AddressSheetProps = {
  state: AddressSheetState | null;
  onClose: () => void;
  onSave: (address: BrandAddressForm) => void;
  t: ReturnType<typeof useTranslations>;
};

function AddressSheet({ state, onClose, onSave, t }: AddressSheetProps) {
  const open = Boolean(state);
  const [draft, setDraft] = useState<BrandAddressForm>(state?.address ?? emptyAddress());

  useEffect(() => {
    if (state?.address) {
      setDraft(state.address);
    } else if (!state) {
      setDraft(emptyAddress());
    }
  }, [state]);

  if (!state) {
    return null;
  }

  const title =
    state.mode === "edit" ? t("addresses.sheet.editTitle") : t("addresses.sheet.createTitle");
  const primaryLabel =
    state.mode === "edit" ? t("addresses.sheet.saveButton") : t("addresses.sheet.createButton");

  const handleChange = (
    field: keyof Omit<BrandAddressForm, "clientKey" | "id" | "createdAt" | "updatedAt">,
    value: string,
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(draft);
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <SheetContent className="flex h-full max-w-md flex-col p-0">
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader className="border-b border-slate-200 px-6 py-5 text-left">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{t("addresses.sheet.description")}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
            <div className="space-y-1.5">
              <Label htmlFor="address-label-field">{t("addresses.fields.label")}</Label>
              <Input
                id="address-label-field"
                value={draft.label}
                onChange={(event) => handleChange("label", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address-company-field">{t("addresses.fields.company")}</Label>
              <Input
                id="address-company-field"
                value={draft.company}
                onChange={(event) => handleChange("company", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address-url-field">{t("addresses.fields.url")}</Label>
              <Input
                id="address-url-field"
                value={draft.url}
                onChange={(event) => handleChange("url", event.target.value)}
                placeholder="https://"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address-street-field">{t("addresses.fields.street")}</Label>
              <Input
                id="address-street-field"
                value={draft.street}
                onChange={(event) => handleChange("street", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address-extra-field">{t("addresses.fields.addressExtra")}</Label>
              <Input
                id="address-extra-field"
                value={draft.addressExtra}
                onChange={(event) => handleChange("addressExtra", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address-card-field">{t("addresses.fields.cardAddressText")}</Label>
              <Textarea
                id="address-card-field"
                value={draft.cardAddressText}
                onChange={(event) => handleChange("cardAddressText", event.target.value)}
                rows={4}
              />
              <p className="text-xs text-slate-500">{t("addresses.cardAddressHint")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="address-postal-field">{t("addresses.fields.postalCode")}</Label>
                <Input
                  id="address-postal-field"
                  value={draft.postalCode}
                  onChange={(event) => handleChange("postalCode", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address-city-field">{t("addresses.fields.city")}</Label>
                <Input
                  id="address-city-field"
                  value={draft.city}
                  onChange={(event) => handleChange("city", event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address-country-field">{t("addresses.fields.countryCode")}</Label>
              <Input
                id="address-country-field"
                value={draft.countryCode}
                onChange={(event) => handleChange("countryCode", event.target.value)}
                placeholder="AT"
              />
              <p className="text-xs text-slate-500">{t("addresses.countryHint")}</p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("addresses.sheet.cancelButton")}
            </Button>
            <Button type="submit">{primaryLabel}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function formatAddressPreview(address: BrandAddressForm) {
  const parts = [
    address.street,
    address.addressExtra,
    [address.postalCode, address.city].filter(Boolean).join(" ").trim(),
    address.url,
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
