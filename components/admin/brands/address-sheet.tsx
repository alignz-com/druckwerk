"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import type { AdminBrandSummary } from "@/lib/admin/brands-data";
import { useTranslations } from "@/components/providers/locale-provider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ISO 3166-1 alpha-2 country list (name → code)
const COUNTRIES: { code: string; name: string }[] = [
  { code: "AT", name: "Österreich" },
  { code: "DE", name: "Deutschland" },
  { code: "CH", name: "Schweiz" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LU", name: "Luxemburg" },
  { code: "BE", name: "Belgien" },
  { code: "NL", name: "Niederlande" },
  { code: "FR", name: "Frankreich" },
  { code: "IT", name: "Italien" },
  { code: "ES", name: "Spanien" },
  { code: "PT", name: "Portugal" },
  { code: "GB", name: "Vereinigtes Königreich" },
  { code: "IE", name: "Irland" },
  { code: "DK", name: "Dänemark" },
  { code: "SE", name: "Schweden" },
  { code: "NO", name: "Norwegen" },
  { code: "FI", name: "Finnland" },
  { code: "PL", name: "Polen" },
  { code: "CZ", name: "Tschechien" },
  { code: "SK", name: "Slowakei" },
  { code: "HU", name: "Ungarn" },
  { code: "SI", name: "Slowenien" },
  { code: "HR", name: "Kroatien" },
  { code: "RO", name: "Rumänien" },
  { code: "BG", name: "Bulgarien" },
  { code: "GR", name: "Griechenland" },
  { code: "TR", name: "Türkei" },
  { code: "RU", name: "Russland" },
  { code: "UA", name: "Ukraine" },
  { code: "US", name: "Vereinigte Staaten" },
  { code: "CA", name: "Kanada" },
  { code: "AU", name: "Australien" },
  { code: "NZ", name: "Neuseeland" },
  { code: "JP", name: "Japan" },
  { code: "CN", name: "China" },
  { code: "IN", name: "Indien" },
  { code: "BR", name: "Brasilien" },
  { code: "MX", name: "Mexiko" },
  { code: "ZA", name: "Südafrika" },
  { code: "AE", name: "Vereinigte Arabische Emirate" },
  { code: "SG", name: "Singapur" },
];

function CountrySelect({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [search]);

  const selected = COUNTRIES.find((c) => c.code === value.toUpperCase());

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setTimeout(() => inputRef.current?.focus(), 0); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700",
            "focus:outline-none focus:ring-2 focus:ring-slate-400",
            !selected && "text-slate-400"
          )}
        >
          {selected ? `${selected.code} – ${selected.name}` : (placeholder ?? "Land wählen …")}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="border-b border-slate-100 px-3 py-2">
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen …"
            className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <ul className="max-h-56 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">Keine Treffer</li>
          ) : (
            filtered.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50"
                  onClick={() => { onChange(c.code); setOpen(false); setSearch(""); }}
                >
                  <Check className={cn("h-4 w-4 shrink-0", value.toUpperCase() === c.code ? "text-slate-700" : "invisible")} />
                  <span className="font-mono text-xs text-slate-400 w-6">{c.code}</span>
                  {c.name}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

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
    <Dialog open={Boolean(state)} onOpenChange={(next) => (!next && !isSaving ? onClose() : null)}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col p-0">
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <DialogHeader className="border-b border-slate-200 px-6 py-5 text-left">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{t("addresses.sheet.description")}</DialogDescription>
          </DialogHeader>
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
              <Label>{t("addresses.fields.countryCode")}</Label>
              <CountrySelect
                value={draft.countryCode}
                onChange={(code) => handleChange("countryCode", code)}
              />
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
      </DialogContent>
    </Dialog>
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
