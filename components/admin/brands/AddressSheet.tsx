"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import type { AdminBrandSummary } from "@/lib/admin/brands-data";
import { useLocale, useTranslations } from "@/components/providers/locale-provider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// DACH first, then all remaining ISO 3166-1 alpha-2 codes
const DACH_CODES = ["AT", "DE", "CH", "LI"];
const ALL_CODES = [
  "AF","EG","AL","DZ","AD","AO","AG","AR","AM","AZ","ET","AU","BS","BH","BD",
  "BB","BY","BE","BZ","BJ","BT","BO","BA","BW","BR","BN","BG","BF","BI","CV",
  "CL","CN","CK","CR","CI","CU","DK","CD","DM","DO","DJ","EC","SV","ER","EE",
  "SZ","FJ","FI","FR","GA","GM","GE","GH","GD","GR","GT","GN","GW","GY","HT",
  "HN","IN","ID","IQ","IR","IE","IS","IL","IT","JM","JP","YE","JO","KH","CM",
  "CA","KZ","QA","KE","KG","KI","CO","KM","CG","KP","KR","HR","KW","LA","LS",
  "LV","LB","LR","LY","LT","LU","MG","MW","MY","MV","ML","MT","MA","MH","MR",
  "MU","MX","FM","MD","MC","MN","ME","MZ","MM","NA","NR","NP","NZ","NI","NL",
  "NE","NG","MK","NO","OM","PK","PW","PA","PG","PY","PE","PH","PL","PT","RW",
  "RO","RU","SB","ZM","WS","SM","ST","SA","SE","SN","RS","SC","SL","ZW","SG",
  "SK","SI","SO","ES","LK","KN","LC","VC","ZA","SS","SD","SR","SY","TJ","TZ",
  "TH","TL","TG","TO","TT","TD","CZ","TN","TR","TM","TV","UG","UA","HU","UY",
  "UZ","VU","VA","VE","AE","US","GB","VN","CF","CY",
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
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const countries = useMemo(() => {
    const dn = new Intl.DisplayNames([locale === "de" ? "de" : "en"], { type: "region" });
    const resolve = (code: string) => ({ code, name: dn.of(code) ?? code });
    const dach = DACH_CODES.map(resolve);
    const rest = ALL_CODES.map(resolve).sort((a, b) => a.name.localeCompare(b.name, locale));
    return [...dach, ...rest];
  }, [locale]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [search, countries]);

  const selected = countries.find((c) => c.code === value.toUpperCase());

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setTimeout(() => inputRef.current?.focus(), 0); }}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700",
          "focus:outline-none focus:ring-2 focus:ring-slate-400",
          !selected && "text-slate-400"
        )}
      >
        {selected ? `${selected.code} – ${selected.name}` : (placeholder ?? "Land wählen …")}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-50 bottom-full mb-1 w-full rounded-md border border-slate-200 bg-white shadow-lg flex flex-col" style={{ maxHeight: "16rem" }}>
          <div className="shrink-0 border-b border-slate-100 px-3 py-2">
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
              placeholder="Suchen …"
              className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <ul className="overflow-y-scroll py-1" style={{ minHeight: 0 }}>
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
        </div>
      )}
    </div>
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
