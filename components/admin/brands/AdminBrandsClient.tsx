"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { AdminBrandAddress, AdminBrandSummary } from "@/lib/admin/brands-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/components/providers/locale-provider";

type Props = {
  brands: AdminBrandSummary[];
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
});

export default function AdminBrandsClient({ brands }: Props) {
  const router = useRouter();
  const t = useTranslations("admin.brands");
  const [form, setForm] = useState<BrandForm | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedBrands = useMemo(
    () => brands.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [brands],
  );

  const openCreate = () => {
    setForm(emptyForm());
    setMode("create");
    setError(null);
  };

  const openEdit = (brand: AdminBrandSummary) => {
    setForm({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      contactName: brand.contactName ?? "",
      contactEmail: brand.contactEmail ?? "",
      contactPhone: brand.contactPhone ?? "",
      addresses: brand.addresses.map((address) => mapAddressToForm(address)),
    });
    setMode("edit");
    setError(null);
  };

  const closeDialog = () => {
    setForm(null);
    setMode(null);
    setIsSubmitting(false);
    setError(null);
  };

  const handleFieldChange = (field: keyof Omit<BrandForm, "id" | "addresses">, value: string) => {
    if (!form) return;
    setForm({ ...form, [field]: value });
  };

  const handleAddressChange = (clientKey: string, field: keyof BrandAddressForm, value: string) => {
    if (!form) return;
    setForm({
      ...form,
      addresses: form.addresses.map((address) =>
        address.clientKey === clientKey ? { ...address, [field]: value } : address,
      ),
    });
  };

  const addAddress = () => {
    if (!form) return;
    setForm({ ...form, addresses: [...form.addresses, emptyAddress()] });
  };

  const removeAddress = (clientKey: string) => {
    if (!form) return;
    setForm({ ...form, addresses: form.addresses.filter((address) => address.clientKey !== clientKey) });
  };

  const submit = async () => {
    if (!form || !mode) return;
    setIsSubmitting(true);
    setError(null);

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
      })),
    };

    try {
      const response = await fetch(mode === "create" ? "/api/admin/brands" : `/api/admin/brands/${form.id}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? "Request failed");
      }
      closeDialog();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setIsSubmitting(false);
    }
  };

  const deleteBrand = async () => {
    if (!form?.id) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/brands/${form.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? "Delete failed");
      }
      closeDialog();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setIsSubmitting(false);
    }
  };

  const activeTitle = mode === "create" ? t("dialog.createTitle") : t("dialog.editTitle", { name: form?.name ?? "" });

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500">{t("description")}</p>
        </div>
        <Button onClick={openCreate} className="self-start sm:self-auto">
          {t("actions.newBrand")}
        </Button>
      </header>

      <Card>
        <CardHeader className="border-b border-slate-200 bg-slate-50/60">
          <CardTitle className="text-lg">{t("table.title")}</CardTitle>
          <CardDescription>{t("table.description")}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 py-0">
          {sortedBrands.length === 0 ? (
            <div className="px-6 py-8 text-sm text-slate-500">{t("table.empty")}</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">{t("table.headers.brand")}</th>
                  <th className="px-6 py-3 text-left font-semibold">{t("table.headers.contact")}</th>
                  <th className="px-6 py-3 text-left font-semibold">{t("table.headers.templates")}</th>
                  <th className="px-6 py-3 text-left font-semibold">{t("table.headers.addresses")}</th>
                  <th className="px-6 py-3 text-right font-semibold">{t("table.headers.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {sortedBrands.map((brand) => (
                  <tr key={brand.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{brand.name}</div>
                      <div className="text-xs text-slate-500">{brand.slug}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      <div>{brand.contactName ?? t("table.noContact")}</div>
                      {brand.contactEmail ? <div>{brand.contactEmail}</div> : null}
                      {brand.contactPhone ? <div>{brand.contactPhone}</div> : null}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">{brand.templateCount}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">{brand.addresses.length}</td>
                    <td className="px-6 py-4 text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(brand)}>
                        {t("actions.manage")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(form && mode)} onOpenChange={(open) => (!open ? closeDialog() : null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{activeTitle}</DialogTitle>
            <DialogDescription>{t("dialog.description")}</DialogDescription>
          </DialogHeader>

          {form ? (
            <div className="space-y-6">
              <section className="grid gap-4 sm:grid-cols-2">
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
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">{t("addresses.title")}</h3>
                  <Button type="button" size="sm" variant="outline" onClick={addAddress}>
                    {t("addresses.add")}
                  </Button>
                </div>

                {form.addresses.length === 0 ? (
                  <p className="text-xs text-slate-500">{t("addresses.empty")}</p>
                ) : (
                  <div className="space-y-4">
                    {form.addresses.map((address) => (
                      <div key={address.clientKey} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                            <div className="space-y-1.5">
                              <Label>{t("addresses.fields.label")}</Label>
                              <Input
                                value={address.label}
                                onChange={(event) => handleAddressChange(address.clientKey, "label", event.target.value)}
                                maxLength={120}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>{t("addresses.fields.company")}</Label>
                              <Input
                                value={address.company}
                                onChange={(event) => handleAddressChange(address.clientKey, "company", event.target.value)}
                                maxLength={200}
                              />
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label>{t("addresses.fields.street")}</Label>
                              <Input
                                value={address.street}
                                onChange={(event) => handleAddressChange(address.clientKey, "street", event.target.value)}
                                maxLength={200}
                              />
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label>{t("addresses.fields.addressExtra")}</Label>
                              <Input
                                value={address.addressExtra}
                                onChange={(event) =>
                                  handleAddressChange(address.clientKey, "addressExtra", event.target.value)
                                }
                                maxLength={200}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>{t("addresses.fields.postalCode")}</Label>
                              <Input
                                value={address.postalCode}
                                onChange={(event) =>
                                  handleAddressChange(address.clientKey, "postalCode", event.target.value)
                                }
                                maxLength={40}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>{t("addresses.fields.city")}</Label>
                              <Input
                                value={address.city}
                                onChange={(event) => handleAddressChange(address.clientKey, "city", event.target.value)}
                                maxLength={120}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>{t("addresses.fields.countryCode")}</Label>
                              <Input
                                value={address.countryCode}
                                onChange={(event) => handleAddressChange(address.clientKey, "countryCode", event.target.value)}
                                maxLength={2}
                                placeholder="AT"
                              />
                              <p className="text-xs text-slate-500">{t("addresses.countryHint")}</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            className="self-start text-red-600 hover:text-red-700"
                            onClick={() => removeAddress(address.clientKey)}
                          >
                            {t("addresses.remove")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
          ) : null}

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            {mode === "edit" ? (
              <Button
                type="button"
                variant="destructive"
                className="sm:order-first"
                disabled={isSubmitting}
                onClick={deleteBrand}
              >
                {t("actions.delete")}
              </Button>
            ) : <span />}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>
                {t("actions.cancel")}
              </Button>
              <Button onClick={submit} disabled={isSubmitting || !form?.name.trim()}>
                {isSubmitting ? t("actions.saving") : t("actions.save")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
  };
}
