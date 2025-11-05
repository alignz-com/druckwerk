"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

import type { AdminBrandAddress, AdminBrandSummary } from "@/lib/admin/brands-data";
import { useTranslations } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

export type BrandDetailClientProps = {
  brand?: AdminBrandSummary | null;
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

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function BrandDetailClient({ brand }: BrandDetailClientProps) {
  const router = useRouter();
  const t = useTranslations("admin.brands");
  const mode: "create" | "edit" = brand ? "edit" : "create";
  const [form, setForm] = useState<BrandForm>(() => (brand ? mapBrandToForm(brand) : emptyForm()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (brand) {
      setForm(mapBrandToForm(brand));
    } else {
      setForm(emptyForm());
    }
  }, [brand]);

  const addressesCount = form.addresses.length;

  const headerTitle =
    mode === "create" ? t("dialog.createTitle") : t("dialog.editTitle", { name: brand?.name ?? "" });

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
    if (!brand?.id) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/brands/${brand.id}`, { method: "DELETE" });
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

  const stats = useMemo(() => {
    if (!brand) return null;
    return [
      { label: t("detail.stats.templates"), value: brand.templateCount },
      { label: t("detail.stats.orders"), value: brand.orderCount },
      { label: t("detail.stats.addresses"), value: addressesCount },
    ];
  }, [addressesCount, brand, t]);

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
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{t("detail.sections.general.title")}</CardTitle>
              <CardDescription>{t("detail.sections.general.description")}</CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{t("detail.sections.addresses.title")}</CardTitle>
                <CardDescription>{t("detail.sections.addresses.description")}</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addAddress}>
                <Plus className="mr-2 h-4 w-4" />
                {t("addresses.add")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.addresses.length === 0 ? (
                <p className="text-sm text-slate-500">{t("addresses.empty")}</p>
              ) : (
                form.addresses.map((address) => (
                  <div key={address.clientKey} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>{t("addresses.fields.label")}</Label>
                          <Input
                            value={address.label}
                            onChange={(event) =>
                              handleAddressChange(address.clientKey, "label", event.target.value)
                            }
                            maxLength={120}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>{t("addresses.fields.company")}</Label>
                          <Input
                            value={address.company}
                            onChange={(event) =>
                              handleAddressChange(address.clientKey, "company", event.target.value)
                            }
                            maxLength={200}
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>{t("addresses.fields.street")}</Label>
                          <Input
                            value={address.street}
                            onChange={(event) =>
                              handleAddressChange(address.clientKey, "street", event.target.value)
                            }
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
                            onChange={(event) =>
                              handleAddressChange(address.clientKey, "city", event.target.value)
                            }
                            maxLength={120}
                          />
                        </div>
                        <div className="space-y-1.5">
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
                      <Button
                        type="button"
                        variant="ghost"
                        className="self-start text-red-600 hover:text-red-700"
                        onClick={() => removeAddress(address.clientKey)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t("addresses.remove")}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {brand ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("detail.sections.metadata.title")}</CardTitle>
                <CardDescription>{t("detail.sections.metadata.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {stats ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    {stats.map((item) => (
                      <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
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
              </CardContent>
            </Card>
          ) : null}

          {mode === "edit" ? (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-700">{t("detail.sections.danger.title")}</CardTitle>
                <CardDescription className="text-red-600">
                  {t("detail.sections.danger.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-red-700">{t("detail.sections.danger.helper")}</p>
                <Button type="button" variant="destructive" onClick={deleteBrand} disabled={isSubmitting}>
                  {t("actions.delete")}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </ScrollArea>
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
