"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  LayoutTemplate,
  MapPin,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import type { AdminBrandAddress, AdminBrandSummary } from "@/lib/admin/brands-data";
import { useLocale, useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/formatDateTime";
import {
  dataTableContainerClass,
  dataTableHeaderClass,
  dataTableRowClass,
} from "@/components/admin/shared/data-table-styles";
import { AddressSheet, type AddressSheetState, type BrandAddressDraft } from "./address-sheet";
import BrandTemplateSection from "./BrandTemplateSection";
import LogoUpload from "./LogoUpload";

// ─── Types ───────────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  slug: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl: string;
  qrMode: "VCARD_ONLY" | "PUBLIC_PROFILE_ONLY" | "BOTH";
  defaultQrMode: "VCARD_ONLY" | "PUBLIC_PROFILE_ONLY" | "";
  quantityMin: string;
  quantityMax: string;
  quantityStep: string;
  quantityOptions: string;
  canOrderBusinessCards: boolean;
  canOrderPdfPrint: boolean;
};

type AddressForm = BrandAddressDraft;

export type BrandFormPageProps = {
  brand?: AdminBrandSummary | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function mapBrandToForm(brand: AdminBrandSummary): FormState {
  return {
    name: brand.name,
    slug: brand.slug ?? "",
    contactName: brand.contactName ?? "",
    contactEmail: brand.contactEmail ?? "",
    contactPhone: brand.contactPhone ?? "",
    logoUrl: brand.logoUrl ?? "",
    qrMode: (brand.qrMode as FormState["qrMode"]) ?? "VCARD_ONLY",
    defaultQrMode: (brand.defaultQrMode as FormState["defaultQrMode"]) ?? "",
    quantityMin: brand.quantityMin != null ? String(brand.quantityMin) : "",
    quantityMax: brand.quantityMax != null ? String(brand.quantityMax) : "",
    quantityStep: brand.quantityStep != null ? String(brand.quantityStep) : "",
    quantityOptions: brand.quantityOptions?.join(", ") ?? "",
    canOrderBusinessCards: brand.canOrderBusinessCards ?? true,
    canOrderPdfPrint: brand.canOrderPdfPrint ?? false,
  };
}

function emptyForm(): FormState {
  return {
    name: "",
    slug: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    logoUrl: "",
    qrMode: "VCARD_ONLY",
    defaultQrMode: "",
    quantityMin: "",
    quantityMax: "",
    quantityStep: "",
    quantityOptions: "",
    canOrderBusinessCards: true,
    canOrderPdfPrint: false,
  };
}

function parseOptionalPositiveInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { value: null as number | null, error: null as string | null };
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { value: null as number | null, error: "invalid" };
  }
  return { value: parsed, error: null as string | null };
}

function parseQuantityOptions(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { value: null as number[] | null, error: null as string | null };
  const parts = trimmed.split(/[,\s]+/).filter(Boolean);
  const parsed = parts.map((part) => Number.parseInt(part, 10));
  if (parsed.some((entry) => !Number.isFinite(entry) || entry <= 0)) {
    return { value: null as number[] | null, error: "invalid" };
  }
  const unique = Array.from(new Set(parsed)).sort((a, b) => a - b);
  return { value: unique.length > 0 ? unique : null, error: null as string | null };
}

function mapAddressToForm(address: AdminBrandAddress): AddressForm {
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
    cardAddressText: address.cardAddressText ?? "",
    url: address.url ?? "",
    createdAt: address.createdAt ?? null,
    updatedAt: address.updatedAt ?? null,
  };
}

function formatAddressPreview(address: AddressForm) {
  const parts = [
    address.street,
    address.addressExtra,
    [address.postalCode, address.city].filter(Boolean).join(" ").trim(),
    address.url ?? "",
  ].filter((v) => v && v.trim().length > 0);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BrandFormPage({ brand }: BrandFormPageProps) {
  const router = useRouter();
  const t = useTranslations("admin.brands");
  const { locale } = useLocale();
  const dateLocale = locale === "de" ? "de-AT" : "en-GB";
  const formatTs = (value: string | Date | null | undefined) =>
    value ? formatDateTime(value, dateLocale, { dateStyle: "medium", timeStyle: "short" }) : "—";

  const mode: "create" | "edit" = brand ? "edit" : "create";

  // ── Form state ─────────────────────────────────────────────────────────────
  const [snapshot, setSnapshot] = useState<AdminBrandSummary | null>(brand ?? null);
  const [form, setForm] = useState<FormState>(() => (brand ? mapBrandToForm(brand) : emptyForm()));
  const [addresses, setAddresses] = useState<AddressForm[]>(
    () => brand?.addresses.map(mapAddressToForm) ?? []
  );

  // Domains: in edit mode managed via immediate API calls; in create mode batched
  const [pendingDomains, setPendingDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);

  // Address sheet
  const [addressSheet, setAddressSheet] = useState<AddressSheetState | null>(null);
  const [addressSearch, setAddressSearch] = useState("");

  // Save state
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (brand) {
      setSnapshot(brand);
      setForm(mapBrandToForm(brand));
      setAddresses(brand.addresses.map(mapAddressToForm));
    }
  }, [brand]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const editDomains = snapshot?.domains ?? [];

  const filteredAddresses = useMemo(() => {
    const q = addressSearch.trim().toLowerCase();
    if (!q) return addresses;
    return addresses.filter((a) =>
      [a.label, a.company, a.street, a.addressExtra, a.postalCode, a.city, a.countryCode, a.url]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [addresses, addressSearch]);

  // ── Field helpers ──────────────────────────────────────────────────────────
  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── Domain management ──────────────────────────────────────────────────────
  const addPendingDomain = () => {
    const value = domainInput.trim().toLowerCase();
    if (!value) return;
    setPendingDomains((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setDomainInput("");
  };

  const removePendingDomain = (domain: string) =>
    setPendingDomains((prev) => prev.filter((d) => d !== domain));

  const addEditDomain = async () => {
    if (!snapshot?.id) return;
    const value = domainInput.trim().toLowerCase();
    if (!value) return;
    setDomainBusy(true);
    setDomainError(null);
    try {
      const res = await fetch(`/api/admin/brands/${snapshot.id}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? t("domains.errors.createFailed"));
      if (data.brand) setSnapshot(data.brand as AdminBrandSummary);
      setDomainInput("");
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : t("domains.errors.createFailed"));
    } finally {
      setDomainBusy(false);
    }
  };

  const removeEditDomain = async (domainId: string) => {
    if (!snapshot?.id) return;
    setDomainBusy(true);
    setDomainError(null);
    try {
      const res = await fetch(`/api/admin/brands/${snapshot.id}/domains`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? t("domains.errors.deleteFailed"));
      if (data.brand) setSnapshot(data.brand as AdminBrandSummary);
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : t("domains.errors.deleteFailed"));
    } finally {
      setDomainBusy(false);
    }
  };

  // ── Address management ────────────────────────────────────────────────────
  const handleAddressSaved = (updatedBrand: AdminBrandSummary) => {
    setSnapshot(updatedBrand);
    setAddresses(updatedBrand.addresses.map(mapAddressToForm));
    setAddressSheet(null);
  };

  const handleAddressDelete = async (clientKey: string) => {
    if (!snapshot?.id) return;
    if (!window.confirm(t("addresses.confirmDelete"))) return;
    try {
      const res = await fetch(`/api/admin/brands/${snapshot.id}/addresses/${clientKey}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.brand) throw new Error(data?.error ?? "Delete failed");
      const updated = data.brand as AdminBrandSummary;
      setSnapshot(updated);
      setAddresses(updated.addresses.map(mapAddressToForm));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) return;
    setFormError(null);

    const minResult = parseOptionalPositiveInt(form.quantityMin);
    const maxResult = parseOptionalPositiveInt(form.quantityMax);
    const stepResult = parseOptionalPositiveInt(form.quantityStep);
    const optResult = parseQuantityOptions(form.quantityOptions);

    if (minResult.error || maxResult.error || stepResult.error || optResult.error) {
      setFormError(t("form.quantityInvalid"));
      return;
    }
    if (
      minResult.value !== null &&
      maxResult.value !== null &&
      maxResult.value < minResult.value
    ) {
      setFormError(t("form.quantityRangeInvalid"));
      return;
    }

    setSaving(true);

    const mainPayload = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      contactName: form.contactName.trim() || null,
      contactEmail: form.contactEmail.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      logoUrl: form.logoUrl.trim() || null,
      qrMode: form.qrMode,
      defaultQrMode:
        form.qrMode === "BOTH" ? (form.defaultQrMode || "VCARD_ONLY") : null,
      quantityMin: minResult.value,
      quantityMax: maxResult.value,
      quantityStep: stepResult.value,
      quantityOptions: optResult.value,
    };

    try {
      if (mode === "create") {
        // Create
        const res = await fetch("/api/admin/brands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mainPayload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.brandId) throw new Error(data?.error ?? t("toast.createFailed"));

        const brandId: string = data.brandId;

        // Access flags (only if non-default)
        if (!form.canOrderBusinessCards || form.canOrderPdfPrint) {
          await fetch(`/api/admin/brands/${brandId}/access`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              canOrderBusinessCards: form.canOrderBusinessCards,
              canOrderPdfPrint: form.canOrderPdfPrint,
            }),
          });
        }

        // Domains
        for (const domain of pendingDomains) {
          await fetch(`/api/admin/brands/${brandId}/domains`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain }),
          });
        }

        router.push(`/admin/brands/${brandId}`);
        router.refresh();
        return;
      }

      // Edit — parallel PATCH for main + access
      const [mainRes, accessRes] = await Promise.all([
        fetch(`/api/admin/brands/${snapshot!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mainPayload),
        }),
        fetch(`/api/admin/brands/${snapshot!.id}/access`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            canOrderBusinessCards: form.canOrderBusinessCards,
            canOrderPdfPrint: form.canOrderPdfPrint,
          }),
        }),
      ]);

      if (!mainRes.ok) {
        const data = await mainRes.json().catch(() => ({}));
        throw new Error(data?.error ?? t("toast.updateFailed"));
      }
      if (!accessRes.ok) {
        const data = await accessRes.json().catch(() => ({}));
        throw new Error(data?.error ?? t("toast.updateFailed"));
      }

      const mainData = await mainRes.json().catch(() => ({}));
      if (mainData?.brand) {
        setSnapshot(mainData.brand as AdminBrandSummary);
      }

      router.refresh();
      setFeedback({ text: t("toast.updated", { name: form.name.trim() }), ok: true });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({
        text: err instanceof Error ? err.message : t("toast.updateFailed"),
        ok: false,
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete brand ───────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!snapshot?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/brands/${snapshot.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Delete failed");
      }
      router.push("/admin/brands");
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Delete failed");
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const headerTitle =
    mode === "create"
      ? t("dialog.createTitle")
      : t("dialog.editTitle", { name: snapshot?.name ?? "" });

  const selectClass = cn(
    "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700",
    "focus:outline-none focus:ring-2 focus:ring-slate-400"
  );

  const domainList = mode === "edit" ? editDomains : pendingDomains.map((d) => ({ id: d, domain: d }));
  const handleAddDomain = mode === "edit" ? addEditDomain : () => { addPendingDomain(); };
  const handleRemoveDomain = mode === "edit"
    ? (id: string) => removeEditDomain(id)
    : (id: string) => removePendingDomain(id);

  return (
    <>
      <div className="space-y-6 pb-24">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/admin/brands" className="flex items-center gap-1.5 hover:text-slate-600 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("detail.back")}
          </Link>
          <span>/</span>
          <span className="text-slate-700 font-medium">
            {mode === "create" ? t("dialog.createTitle") : (snapshot?.name ?? "")}
          </span>
        </nav>

        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{headerTitle}</h1>
          <div className="flex items-center gap-3">
            {feedback && (
              <span className={`text-sm ${feedback.ok ? "text-emerald-600" : "text-red-600"}`}>
                {feedback.text}
              </span>
            )}
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
            >
              {saving ? "…" : mode === "create" ? t("actions.create") : t("actions.save")}
            </Button>
          </div>
        </div>

        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        <Tabs defaultValue="general">
              <TabsList className="mb-6 h-auto flex-wrap gap-1 bg-slate-100 p-1">
                <TabsTrigger value="general" className="flex items-center gap-2 data-[state=active]:bg-white">
                  <Building2 className="h-4 w-4" />
                  {t("tabs.general")}
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2 data-[state=active]:bg-white">
                  <Settings2 className="h-4 w-4" />
                  {t("tabs.settings")}
                </TabsTrigger>
                <TabsTrigger value="access" className="flex items-center gap-2 data-[state=active]:bg-white">
                  <ShieldCheck className="h-4 w-4" />
                  {t("tabs.access")}
                </TabsTrigger>
                {mode === "edit" && (
                  <>
                    <TabsTrigger value="templates" className="flex items-center gap-2 data-[state=active]:bg-white">
                      <LayoutTemplate className="h-4 w-4" />
                      {t("tabs.templates")}
                    </TabsTrigger>
                    <TabsTrigger value="addresses" className="flex items-center gap-2 data-[state=active]:bg-white">
                      <MapPin className="h-4 w-4" />
                      {t("tabs.addresses")}
                    </TabsTrigger>
                  </>
                )}
              </TabsList>

              {/* ── General tab ── */}
              <TabsContent value="general" className="space-y-6">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{t("detail.sections.general.title")}</h2>
                  <p className="text-xs text-slate-500">{t("detail.sections.general.description")}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="fp-name">{t("form.name")} *</Label>
                    <Input
                      id="fp-name"
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      maxLength={200}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fp-slug">{t("form.slug")}</Label>
                    <Input
                      id="fp-slug"
                      value={form.slug}
                      onChange={(e) => setField("slug", e.target.value)}
                      maxLength={200}
                      placeholder={t("form.slugHint")}
                    />
                    <p className="text-xs text-slate-500">{t("form.slugHint")}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fp-contact-name">{t("form.contactName")}</Label>
                    <Input
                      id="fp-contact-name"
                      value={form.contactName}
                      onChange={(e) => setField("contactName", e.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fp-contact-email">{t("form.contactEmail")}</Label>
                    <Input
                      id="fp-contact-email"
                      type="email"
                      value={form.contactEmail}
                      onChange={(e) => setField("contactEmail", e.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fp-contact-phone">{t("form.contactPhone")}</Label>
                    <Input
                      id="fp-contact-phone"
                      value={form.contactPhone}
                      onChange={(e) => setField("contactPhone", e.target.value)}
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <LogoUpload
                      label={t("form.logoUrl")}
                      hint={t("form.logoUrlHint")}
                      value={form.logoUrl}
                      onChange={(url) => setField("logoUrl", url)}
                      disabled={saving}
                    />
                  </div>
                </div>

                {/* Danger zone in edit mode */}
                {mode === "edit" && (
                  <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
                    <div>
                      <h2 className="text-sm font-semibold text-red-900">{t("detail.sections.danger.title")}</h2>
                      <p className="text-xs text-red-700">{t("detail.sections.danger.description")}</p>
                      <p className="text-xs text-red-700">{t("detail.sections.danger.helper")}</p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={saving}
                    >
                      {t("actions.delete")}
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* ── Settings tab ── */}
              <TabsContent value="settings" className="space-y-6">
                {/* QR mode */}
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{t("detail.sections.settings.title")}</h2>
                  <p className="text-xs text-slate-500">{t("detail.sections.settings.description")}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="fp-qr-mode">{t("form.qrMode")}</Label>
                    <select
                      id="fp-qr-mode"
                      value={form.qrMode}
                      onChange={(e) => setField("qrMode", e.target.value as FormState["qrMode"])}
                      className={selectClass}
                    >
                      <option value="VCARD_ONLY">{t("form.qrModes.vcard")}</option>
                      <option value="PUBLIC_PROFILE_ONLY">{t("form.qrModes.public")}</option>
                      <option value="BOTH">{t("form.qrModes.both")}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fp-default-qr-mode">{t("form.defaultQrMode")}</Label>
                    <select
                      id="fp-default-qr-mode"
                      value={form.defaultQrMode}
                      onChange={(e) => setField("defaultQrMode", e.target.value as FormState["defaultQrMode"])}
                      disabled={form.qrMode !== "BOTH"}
                      className={cn(selectClass, "disabled:cursor-not-allowed disabled:opacity-50")}
                    >
                      <option value="VCARD_ONLY">{t("form.qrModes.vcard")}</option>
                      <option value="PUBLIC_PROFILE_ONLY">{t("form.qrModes.public")}</option>
                    </select>
                    {form.qrMode !== "BOTH" && (
                      <p className="text-xs text-slate-500">{t("form.defaultQrModeHint")}</p>
                    )}
                  </div>
                </div>

                {/* Quantities */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{t("detail.sections.quantities.title")}</h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="fp-qty-min">{t("form.quantityMin")}</Label>
                      <Input
                        id="fp-qty-min"
                        inputMode="numeric"
                        value={form.quantityMin}
                        onChange={(e) => setField("quantityMin", e.target.value)}
                        placeholder="50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="fp-qty-max">{t("form.quantityMax")}</Label>
                      <Input
                        id="fp-qty-max"
                        inputMode="numeric"
                        value={form.quantityMax}
                        onChange={(e) => setField("quantityMax", e.target.value)}
                        placeholder="1000"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="fp-qty-step">{t("form.quantityStep")}</Label>
                      <Input
                        id="fp-qty-step"
                        inputMode="numeric"
                        value={form.quantityStep}
                        onChange={(e) => setField("quantityStep", e.target.value)}
                        placeholder="50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="fp-qty-options">{t("form.quantityOptions")}</Label>
                      <Input
                        id="fp-qty-options"
                        value={form.quantityOptions}
                        onChange={(e) => setField("quantityOptions", e.target.value)}
                        placeholder="50, 100, 250"
                      />
                      <p className="text-xs text-slate-500">{t("form.quantityOptionsHint")}</p>
                    </div>
                  </div>
                </div>

                {/* Domains */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{t("domains.title")}</h3>
                      <p className="text-xs text-slate-500">{t("domains.description")}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Input
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddDomain();
                          }
                        }}
                        placeholder={t("domains.placeholder")}
                        className="w-48"
                        disabled={domainBusy}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleAddDomain}
                        disabled={domainBusy || !domainInput.trim()}
                      >
                        {t("domains.add")}
                      </Button>
                    </div>
                  </div>
                  {domainError && <p className="text-xs text-red-600">{domainError}</p>}
                  {domainList.length === 0 ? (
                    <p className="text-xs text-slate-500">{t("domains.empty")}</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2 text-xs text-slate-600">
                      {domainList.map((item) => (
                        <li
                          key={item.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1"
                        >
                          <span>{item.domain}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDomain(item.id)}
                            disabled={domainBusy}
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-50"
                            aria-label={t("domains.removeLabel", { domain: item.domain })}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>

              {/* ── Access tab ── */}
              <TabsContent value="access" className="space-y-6">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{t("detail.sections.access.title")}</h2>
                  <p className="text-xs text-slate-500">{t("detail.sections.access.description")}</p>
                </div>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-slate-300"
                      checked={form.canOrderBusinessCards}
                      onChange={(e) => setField("canOrderBusinessCards", e.target.checked)}
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{t("access.businessCards")}</div>
                      <div className="text-xs text-slate-500">{t("access.businessCardsHint")}</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-slate-300"
                      checked={form.canOrderPdfPrint}
                      onChange={(e) => setField("canOrderPdfPrint", e.target.checked)}
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-900">{t("access.pdfPrint")}</div>
                      <div className="text-xs text-slate-500">{t("access.pdfPrintHint")}</div>
                    </div>
                  </label>
                </div>
              </TabsContent>

              {/* ── Templates tab (edit only) ── */}
              {mode === "edit" && (
                <TabsContent value="templates">
                  <BrandTemplateSection
                    brandId={snapshot?.id}
                    templates={snapshot?.templates ?? []}
                    defaultTemplateId={snapshot?.defaultTemplateId ?? null}
                    onBrandUpdated={(updated) => setSnapshot(updated)}
                  />
                </TabsContent>
              )}

              {/* ── Addresses tab (edit only) ── */}
              {mode === "edit" && (
                <TabsContent value="addresses" className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">{t("detail.sections.addresses.title")}</h2>
                      <p className="text-xs text-slate-500">{t("detail.sections.addresses.description")}</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setAddressSheet({ mode: "create", address: emptyAddress() })}
                      className="self-start sm:self-auto"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t("addresses.add")}
                    </Button>
                  </div>
                  <div className="relative w-full sm:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={addressSearch}
                      onChange={(e) => setAddressSearch(e.target.value)}
                      placeholder={t("addresses.searchPlaceholder")}
                      className="pl-9"
                    />
                  </div>
                  <div className={dataTableContainerClass}>
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
                                {address.cardAddressText && (
                                  <p className="mt-1 whitespace-pre-line text-xs text-slate-500">
                                    {address.cardAddressText}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="align-top text-sm text-slate-600">
                                {address.countryCode ? address.countryCode.toUpperCase() : "—"}
                              </TableCell>
                              <TableCell className="align-top text-sm text-slate-600">
                                {formatTs(address.updatedAt)}
                              </TableCell>
                              <TableCell className="align-top">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t("addresses.actions.edit")}
                                    onClick={() => {
                                      setAddressSheet({ mode: "edit", address });
                                    }}
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
                </TabsContent>
              )}
        </Tabs>
      </div>

      {/* Address dialog */}
      {mode === "edit" && (
        <AddressSheet
          brandId={snapshot?.id ?? ""}
          state={addressSheet}
          onClose={() => setAddressSheet(null)}
          onSaved={handleAddressSaved}
        />
      )}
    </>
  );
}
