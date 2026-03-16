"use client";

import { useEffect, useState } from "react";

import type { AdminBrandSummary } from "@/lib/admin/brands-data";
import { useTranslations } from "@/components/providers/locale-provider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type BrandAddressDraft = {
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
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AddressSheetState = {
  mode: "create" | "edit";
  address: BrandAddressDraft;
};

type AddressSheetProps = {
  brandId: string;
  state: AddressSheetState | null;
  onClose: () => void;
  onSaved: (brand: AdminBrandSummary) => void;
};

export function AddressSheet({ brandId, state, onClose, onSaved }: AddressSheetProps) {
  const t = useTranslations("admin.brands");
  const [draft, setDraft] = useState<BrandAddressDraft>(state?.address ?? emptyDraft());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state?.address) {
      setDraft(state.address);
      setError(null);
    } else {
      setDraft(emptyDraft());
      setError(null);
    }
  }, [state]);

  if (!state) {
    return null;
  }

  const title =
    state.mode === "edit" ? t("addresses.sheet.editTitle") : t("addresses.sheet.createTitle");
  const primaryLabel =
    state.mode === "edit" ? t("addresses.sheet.saveButton") : t("addresses.sheet.createButton");

  const handleChange = (field: keyof BrandAddressDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const buildBody = () => ({
    label: draft.label.trim() || null,
    company: draft.company.trim() || null,
    street: draft.street.trim() || null,
    addressExtra: draft.addressExtra.trim() || null,
    postalCode: draft.postalCode.trim() || null,
    city: draft.city.trim() || null,
    countryCode: draft.countryCode.trim().toUpperCase() || null,
    cardAddressText: draft.cardAddressText.trim() || null,
    url: draft.url.trim() || null,
  });

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      let res: Response;
      if (state.mode === "edit" && draft.id) {
        res = await fetch(`/api/admin/brands/${brandId}/addresses/${draft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildBody()),
        });
      } else {
        res = await fetch(`/api/admin/brands/${brandId}/addresses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildBody()),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.brand) {
        throw new Error(data?.error ?? t("addresses.sheet.saveFailed"));
      }

      onSaved(data.brand);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("addresses.sheet.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={Boolean(state)} onOpenChange={(next) => (!next && !isSaving ? onClose() : null)}>
      <SheetContent className="flex h-full max-w-md flex-col p-0">
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader className="border-b border-slate-200 px-6 py-5 text-left">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{t("addresses.sheet.description")}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
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
                value={draft.url ?? ""}
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
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              {t("addresses.sheet.cancelButton")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t("actions.saving") : primaryLabel}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function emptyDraft(): BrandAddressDraft {
  return {
    clientKey: "",
    label: "",
    company: "",
    street: "",
    addressExtra: "",
    postalCode: "",
    city: "",
    countryCode: "",
    cardAddressText: "",
    url: "",
  };
}
