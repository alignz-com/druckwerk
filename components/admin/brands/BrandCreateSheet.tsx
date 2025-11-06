"use client";

import { useMemo, useState } from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "@/components/providers/locale-provider";
import type { AdminBrandSummary } from "@/lib/admin/brands-data";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBrandCreated: (brand: AdminBrandSummary) => void;
};

type AddressForm = {
  clientKey: string;
  label: string;
  company: string;
  street: string;
  addressExtra: string;
  postalCode: string;
  city: string;
  countryCode: string;
  url: string;
};

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
  url: "",
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

  const handleAddressChange = (clientKey: string, field: keyof AddressForm, value: string) => {
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

  const addressRows = useMemo(() => form.addresses, [form.addresses]);

  return (
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
        <SheetHeader className="border-b border-slate-200 px-6 py-5 text-left">
          <SheetTitle>{t("dialog.createTitle")}</SheetTitle>
          <SheetDescription>{t("dialog.description")}</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
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

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{t("addresses.title")}</h3>
                <p className="text-xs text-slate-500">{t("addresses.description")}</p>
              </div>
              <Button variant="secondary" type="button" onClick={addAddress}>
                {t("addresses.add")}
              </Button>
            </div>
            {addressRows.length === 0 ? (
              <p className="text-xs text-slate-500">{t("addresses.empty")}</p>
            ) : null}
            <div className="space-y-4">
              {addressRows.map((address) => (
                <div key={address.clientKey} className="rounded-lg border border-slate-200 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("addresses.fields.label")}</Label>
                      <Input
                        value={address.label}
                        onChange={(event) => handleAddressChange(address.clientKey, "label", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("addresses.fields.company")}</Label>
                      <Input
                        value={address.company}
                        onChange={(event) => handleAddressChange(address.clientKey, "company", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("addresses.fields.url")}</Label>
                      <Input
                        value={address.url}
                        onChange={(event) => handleAddressChange(address.clientKey, "url", event.target.value)}
                        placeholder="https://"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>{t("addresses.fields.street")}</Label>
                      <Input
                        value={address.street}
                        onChange={(event) => handleAddressChange(address.clientKey, "street", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("addresses.fields.addressExtra")}</Label>
                      <Input
                        value={address.addressExtra}
                        onChange={(event) => handleAddressChange(address.clientKey, "addressExtra", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("addresses.fields.postalCode")}</Label>
                      <Input
                        value={address.postalCode}
                        onChange={(event) => handleAddressChange(address.clientKey, "postalCode", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("addresses.fields.city")}</Label>
                      <Input
                        value={address.city}
                        onChange={(event) => handleAddressChange(address.clientKey, "city", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("addresses.fields.countryCode")}</Label>
                      <Input
                        value={address.countryCode}
                        onChange={(event) => handleAddressChange(address.clientKey, "countryCode", event.target.value)}
                        placeholder={t("addresses.countryHint")}
                        maxLength={2}
                      />
                    </div>
                  </div>
                  <div className="mt-3 text-right">
                    <Button variant="ghost" type="button" onClick={() => removeAddress(address.clientKey)}>
                      {t("addresses.remove")}
                    </Button>
                  </div>
                </div>
              ))}
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

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
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
  );
}
