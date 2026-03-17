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

// ISO 3166-1 alpha-2 — full list, DACH first then alphabetical
const COUNTRIES: { code: string; name: string }[] = [
  { code: "AT", name: "Österreich" },
  { code: "DE", name: "Deutschland" },
  { code: "CH", name: "Schweiz" },
  { code: "LI", name: "Liechtenstein" },
  { code: "AF", name: "Afghanistan" },
  { code: "EG", name: "Ägypten" },
  { code: "AL", name: "Albanien" },
  { code: "DZ", name: "Algerien" },
  { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" },
  { code: "AG", name: "Antigua und Barbuda" },
  { code: "AR", name: "Argentinien" },
  { code: "AM", name: "Armenien" },
  { code: "AZ", name: "Aserbaidschan" },
  { code: "ET", name: "Äthiopien" },
  { code: "AU", name: "Australien" },
  { code: "BS", name: "Bahamas" },
  { code: "BH", name: "Bahrain" },
  { code: "BD", name: "Bangladesch" },
  { code: "BB", name: "Barbados" },
  { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgien" },
  { code: "BZ", name: "Belize" },
  { code: "BJ", name: "Benin" },
  { code: "BT", name: "Bhutan" },
  { code: "BO", name: "Bolivien" },
  { code: "BA", name: "Bosnien und Herzegowina" },
  { code: "BW", name: "Botswana" },
  { code: "BR", name: "Brasilien" },
  { code: "BN", name: "Brunei" },
  { code: "BG", name: "Bulgarien" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" },
  { code: "CV", name: "Cabo Verde" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "China" },
  { code: "CK", name: "Cookinseln" },
  { code: "CR", name: "Costa Rica" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "CU", name: "Kuba" },
  { code: "DK", name: "Dänemark" },
  { code: "CD", name: "Demokratische Republik Kongo" },
  { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominikanische Republik" },
  { code: "DJ", name: "Dschibuti" },
  { code: "EC", name: "Ecuador" },
  { code: "SV", name: "El Salvador" },
  { code: "ER", name: "Eritrea" },
  { code: "EE", name: "Estland" },
  { code: "SZ", name: "Eswatini" },
  { code: "FJ", name: "Fidschi" },
  { code: "FI", name: "Finnland" },
  { code: "FR", name: "Frankreich" },
  { code: "GA", name: "Gabun" },
  { code: "GM", name: "Gambia" },
  { code: "GE", name: "Georgien" },
  { code: "GH", name: "Ghana" },
  { code: "GD", name: "Grenada" },
  { code: "GR", name: "Griechenland" },
  { code: "GT", name: "Guatemala" },
  { code: "GN", name: "Guinea" },
  { code: "GW", name: "Guinea-Bissau" },
  { code: "GY", name: "Guyana" },
  { code: "HT", name: "Haiti" },
  { code: "HN", name: "Honduras" },
  { code: "IN", name: "Indien" },
  { code: "ID", name: "Indonesien" },
  { code: "IQ", name: "Irak" },
  { code: "IR", name: "Iran" },
  { code: "IE", name: "Irland" },
  { code: "IS", name: "Island" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italien" },
  { code: "JM", name: "Jamaika" },
  { code: "JP", name: "Japan" },
  { code: "YE", name: "Jemen" },
  { code: "JO", name: "Jordanien" },
  { code: "KH", name: "Kambodscha" },
  { code: "CM", name: "Kamerun" },
  { code: "CA", name: "Kanada" },
  { code: "KZ", name: "Kasachstan" },
  { code: "QA", name: "Katar" },
  { code: "KE", name: "Kenia" },
  { code: "KG", name: "Kirgisistan" },
  { code: "KI", name: "Kiribati" },
  { code: "CO", name: "Kolumbien" },
  { code: "KM", name: "Komoren" },
  { code: "CG", name: "Kongo" },
  { code: "KP", name: "Nordkorea" },
  { code: "KR", name: "Südkorea" },
  { code: "HR", name: "Kroatien" },
  { code: "KW", name: "Kuwait" },
  { code: "LA", name: "Laos" },
  { code: "LS", name: "Lesotho" },
  { code: "LV", name: "Lettland" },
  { code: "LB", name: "Libanon" },
  { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libyen" },
  { code: "LT", name: "Litauen" },
  { code: "LU", name: "Luxemburg" },
  { code: "MG", name: "Madagaskar" },
  { code: "MW", name: "Malawi" },
  { code: "MY", name: "Malaysia" },
  { code: "MV", name: "Malediven" },
  { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" },
  { code: "MA", name: "Marokko" },
  { code: "MH", name: "Marshallinseln" },
  { code: "MR", name: "Mauretanien" },
  { code: "MU", name: "Mauritius" },
  { code: "MX", name: "Mexiko" },
  { code: "FM", name: "Mikronesien" },
  { code: "MD", name: "Moldau" },
  { code: "MC", name: "Monaco" },
  { code: "MN", name: "Mongolei" },
  { code: "ME", name: "Montenegro" },
  { code: "MZ", name: "Mosambik" },
  { code: "MM", name: "Myanmar" },
  { code: "NA", name: "Namibia" },
  { code: "NR", name: "Nauru" },
  { code: "NP", name: "Nepal" },
  { code: "NZ", name: "Neuseeland" },
  { code: "NI", name: "Nicaragua" },
  { code: "NL", name: "Niederlande" },
  { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" },
  { code: "MK", name: "Nordmazedonien" },
  { code: "NO", name: "Norwegen" },
  { code: "OM", name: "Oman" },
  { code: "PK", name: "Pakistan" },
  { code: "PW", name: "Palau" },
  { code: "PA", name: "Panama" },
  { code: "PG", name: "Papua-Neuguinea" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippinen" },
  { code: "PL", name: "Polen" },
  { code: "PT", name: "Portugal" },
  { code: "RW", name: "Ruanda" },
  { code: "RO", name: "Rumänien" },
  { code: "RU", name: "Russland" },
  { code: "SB", name: "Salomonen" },
  { code: "ZM", name: "Sambia" },
  { code: "WS", name: "Samoa" },
  { code: "SM", name: "San Marino" },
  { code: "ST", name: "São Tomé und Príncipe" },
  { code: "SA", name: "Saudi-Arabien" },
  { code: "SE", name: "Schweden" },
  { code: "SN", name: "Senegal" },
  { code: "RS", name: "Serbien" },
  { code: "SC", name: "Seychellen" },
  { code: "SL", name: "Sierra Leone" },
  { code: "ZW", name: "Simbabwe" },
  { code: "SG", name: "Singapur" },
  { code: "SK", name: "Slowakei" },
  { code: "SI", name: "Slowenien" },
  { code: "SO", name: "Somalia" },
  { code: "ES", name: "Spanien" },
  { code: "LK", name: "Sri Lanka" },
  { code: "KN", name: "St. Kitts und Nevis" },
  { code: "LC", name: "St. Lucia" },
  { code: "VC", name: "St. Vincent und die Grenadinen" },
  { code: "ZA", name: "Südafrika" },
  { code: "SS", name: "Südsudan" },
  { code: "SD", name: "Sudan" },
  { code: "SR", name: "Suriname" },
  { code: "SY", name: "Syrien" },
  { code: "TJ", name: "Tadschikistan" },
  { code: "TZ", name: "Tansania" },
  { code: "TH", name: "Thailand" },
  { code: "TL", name: "Timor-Leste" },
  { code: "TG", name: "Togo" },
  { code: "TO", name: "Tonga" },
  { code: "TT", name: "Trinidad und Tobago" },
  { code: "TD", name: "Tschad" },
  { code: "CZ", name: "Tschechien" },
  { code: "TN", name: "Tunesien" },
  { code: "TR", name: "Türkei" },
  { code: "TM", name: "Turkmenistan" },
  { code: "TV", name: "Tuvalu" },
  { code: "UG", name: "Uganda" },
  { code: "UA", name: "Ukraine" },
  { code: "HU", name: "Ungarn" },
  { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Usbekistan" },
  { code: "VU", name: "Vanuatu" },
  { code: "VA", name: "Vatikanstadt" },
  { code: "VE", name: "Venezuela" },
  { code: "AE", name: "Vereinigte Arabische Emirate" },
  { code: "US", name: "Vereinigte Staaten" },
  { code: "GB", name: "Vereinigtes Königreich" },
  { code: "VN", name: "Vietnam" },
  { code: "CF", name: "Zentralafrikanische Republik" },
  { code: "CY", name: "Zypern" },
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
      <PopoverContent align="start" className="w-72 p-0 flex flex-col" style={{ maxHeight: "min(18rem, var(--radix-popover-content-available-height, 18rem))" }}>
        <div className="shrink-0 border-b border-slate-100 px-3 py-2">
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen …"
            className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto py-1">
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
