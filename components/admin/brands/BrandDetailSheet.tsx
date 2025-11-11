"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import type { AdminBrandAddress, AdminBrandSummary } from "@/lib/admin/brands-data";
import { useTranslations } from "@/components/providers/locale-provider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

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

  const addresses = useMemo(() => form.addresses, [form.addresses]);

  const handleFieldChange = (field: keyof Omit<BrandForm, "id" | "addresses">, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleAddressChange = (clientKey: string, field: keyof BrandAddressForm, value: string) => {
    setForm((current) => ({
      ...current,
      addresses: current.addresses.map((address) =>
        address.clientKey === clientKey ? { ...address, [field]: value } : address,
      ),
    }));
  };

  const addAddress = () => {
    setForm((current) => ({ ...current, addresses: [...current.addresses, emptyAddress()] }));
  };

  const removeAddress = (clientKey: string) => {
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
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent className="flex h-full max-w-4xl flex-col p-0">
        {brand ? (
          <>
            <SheetHeader className="border-b border-slate-200 px-6 py-5 text-left">
              <SheetTitle>{brand.name}</SheetTitle>
              <SheetDescription>{t("dialog.description")}</SheetDescription>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
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

                <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <header className="space-y-1">
                    <h2 className="text-sm font-semibold text-slate-900">
                      {t("detail.sections.general.title")}
                    </h2>
                    <p className="text-xs text-slate-500">{t("detail.sections.general.description")}</p>
                  </header>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="brand-name-detail">{t("form.name")}</Label>
                      <Input
                        id="brand-name-detail"
                        value={form.name}
                        onChange={(event) => handleFieldChange("name", event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brand-slug-detail">{t("form.slug")}</Label>
                      <Input
                        id="brand-slug-detail"
                        value={form.slug}
                        onChange={(event) => handleFieldChange("slug", event.target.value)}
                      />
                      <p className="text-xs text-slate-500">{t("form.slugHint")}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brand-contact-name-detail">{t("form.contactName")}</Label>
                      <Input
                        id="brand-contact-name-detail"
                        value={form.contactName}
                        onChange={(event) => handleFieldChange("contactName", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brand-contact-email-detail">{t("form.contactEmail")}</Label>
                      <Input
                        id="brand-contact-email-detail"
                        type="email"
                        value={form.contactEmail}
                        onChange={(event) => handleFieldChange("contactEmail", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="brand-contact-phone-detail">{t("form.contactPhone")}</Label>
                      <Input
                        id="brand-contact-phone-detail"
                        value={form.contactPhone}
                        onChange={(event) => handleFieldChange("contactPhone", event.target.value)}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">{t("addresses.title")}</h2>
                      <p className="text-xs text-slate-500">{t("addresses.description")}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addAddress} disabled={disableActions}>
                      {t("addresses.add")}
                    </Button>
                  </header>
                  <div className="space-y-4">
                    {addresses.length === 0 ? (
                      <p className="text-xs text-slate-500">{t("addresses.empty")}</p>
                    ) : (
                      addresses.map((address) => (
                        <div key={address.clientKey} className="rounded-lg border border-slate-200 p-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>{t("addresses.fields.label")}</Label>
                              <Input
                                value={address.label}
                                onChange={(event) =>
                                  handleAddressChange(address.clientKey, "label", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t("addresses.fields.company")}</Label>
                              <Input
                                value={address.company}
                                onChange={(event) =>
                                  handleAddressChange(address.clientKey, "company", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t("addresses.fields.url")}</Label>
                              <Input
                                value={address.url}
                                onChange={(event) =>
                                  handleAddressChange(address.clientKey, "url", event.target.value)
                                }
                                placeholder="https://"
                              />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label>{t("addresses.fields.street")}</Label>
                              <Input
                                value={address.street}
                                onChange={(event) =>
                                  handleAddressChange(address.clientKey, "street", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t("addresses.fields.addressExtra")}</Label>
                              <Input
                                value={address.addressExtra}
                                onChange={(event) =>
                                  handleAddressChange(address.clientKey, "addressExtra", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <div className="flex items-center justify-between">
                                <Label>{t("addresses.fields.cardAddressText")}</Label>
                                <span className="text-xs text-slate-500">{t("addresses.cardAddressHint")}</span>
                              </div>
                              <Textarea
                                value={address.cardAddressText}
                                onChange={(event) =>
                                  handleAddressChange(address.clientKey, "cardAddressText", event.target.value)
                                }
                                rows={4}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t("addresses.fields.postalCode")}</Label>
                              <Input
                                value={address.postalCode}
                                onChange={(event) =>
                                  handleAddressChange(address.clientKey, "postalCode", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t("addresses.fields.city")}</Label>
                              <Input
                                value={address.city}
                                onChange={(event) =>
                                  handleAddressChange(address.clientKey, "city", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t("addresses.fields.countryCode")}</Label>
                              <Input
                                value={address.countryCode}
                                onChange={(event) =>
                                  handleAddressChange(address.clientKey, "countryCode", event.target.value)
                                }
                                maxLength={2}
                                placeholder="AT"
                              />
                              <p className="text-xs text-slate-500">{t("addresses.countryHint")}</p>
                            </div>
                          </div>
                          <div className="mt-3 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={disableActions}
                              onClick={() => removeAddress(address.clientKey)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t("addresses.remove")}
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">{t("domains.title")}</h2>
                      <p className="text-xs text-slate-500">{t("domains.description")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={domainInput}
                        onChange={(event) => setDomainInput(event.target.value)}
                        placeholder={t("domains.placeholder")}
                        className="w-52"
                        disabled={disableActions}
                      />
                      <Button type="button" variant="secondary" disabled={disableActions} onClick={submitDomain}>
                        {isDomainSubmitting ? t("domains.saving") : t("domains.add")}
                      </Button>
                    </div>
                  </header>
                  {domainError ? (
                    <p className="text-xs text-red-600">{domainError}</p>
                  ) : null}
                  {brand.domains.length === 0 ? (
                    <p className="text-xs text-slate-500">{t("domains.empty")}</p>
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

                <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <header className="space-y-1">
                    <h2 className="text-sm font-semibold text-slate-900">
                      {t("detail.sections.metadata.title")}
                    </h2>
                    <p className="text-xs text-slate-500">{t("detail.sections.metadata.description")}</p>
                  </header>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {t("detail.stats.templates")}
                      </div>
                      <div className="mt-2 text-xl font-semibold text-slate-900">{brand.templateCount}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {t("detail.stats.orders")}
                      </div>
                      <div className="mt-2 text-xl font-semibold text-slate-900">{brand.orderCount}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {t("detail.stats.addresses")}
                      </div>
                      <div className="mt-2 text-xl font-semibold text-slate-900">{addresses.length}</div>
                    </div>
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
              </div>
              <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={disableActions}
                >
                  {t("actions.close")}
                </Button>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button type="button" variant="destructive" onClick={handleDelete} disabled={disableActions}>
                    {t("actions.delete")}
                  </Button>
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
  );
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
  };
}
