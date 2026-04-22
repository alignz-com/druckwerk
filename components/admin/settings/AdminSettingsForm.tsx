"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, FileText, ImagePlus, Loader2, Mail, Receipt, Trash2 } from "lucide-react";

import { useTranslations } from "@/components/providers/locale-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingButton } from "@/components/ui/loading-button";

type FontFamily = { id: string; name: string; slug: string };
type Settings = {
  companyName: string;
  logoUrl: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  confirmationFontFamily: string | null;
  emailBcc: string | null;
  letterheadUrl: string | null;
  safeTopMm: number | null;
  safeBottomMm: number | null;
  safeLeftMm: number | null;
  safeRightMm: number | null;
  addressWindowXMm: number | null;
  addressWindowYMm: number | null;
  addressWindowWidthMm: number | null;
  addressWindowHeightMm: number | null;
};

function MmInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step="0.5"
          min="0"
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? null : Number(v));
          }}
          className="pr-8"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          mm
        </span>
      </div>
    </div>
  );
}

export function AdminSettingsForm() {
  const t = useTranslations("admin.systemSettings");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [fonts, setFonts] = useState<FontFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLetterhead, setUploadingLetterhead] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const letterheadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/settings").then((r) => r.json()),
      fetch("/api/admin/fonts").then((r) => r.json()),
    ]).then(([settingsData, fontsData]) => {
      setSettings(settingsData.settings);
      setFonts(fontsData.families ?? fontsData.fonts ?? []);
      setLoading(false);
    });
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setToast(t("saved"));
        setTimeout(() => setToast(null), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/settings/logo", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        update({ logoUrl: data.url });
      }
    } finally {
      setUploadingLogo(false);
      if (logoRef.current) logoRef.current.value = "";
    }
  };

  const handleLetterheadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLetterhead(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/settings/letterhead", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        update({ letterheadUrl: data.url });
      } else {
        setError(data.error ?? "Upload failed");
      }
    } finally {
      setUploadingLetterhead(false);
      if (letterheadRef.current) letterheadRef.current.value = "";
    }
  };

  if (loading || !settings) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-100" />
        <div className="h-64 max-w-2xl animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-slate-500">{t("description")}</p>
      </header>

      <Tabs defaultValue="company">
        <TabsList className="mb-6 h-auto flex-wrap gap-1 bg-slate-100 p-1">
          <TabsTrigger value="company" className="flex items-center gap-2 data-[state=active]:bg-white">
            <Building2 className="h-4 w-4" />
            {t("tabCompany")}
          </TabsTrigger>
          <TabsTrigger value="confirmation" className="flex items-center gap-2 data-[state=active]:bg-white">
            <Receipt className="h-4 w-4" />
            {t("tabConfirmation")}
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2 data-[state=active]:bg-white">
            <Mail className="h-4 w-4" />
            {t("tabEmail")}
          </TabsTrigger>
        </TabsList>

        {/* ============================================================= */}
        {/* COMPANY TAB                                                    */}
        {/* ============================================================= */}
        <TabsContent value="company" className="space-y-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">{t("companyName")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("companyName")}</Label>
                <Input
                  value={settings.companyName}
                  onChange={(e) => update({ companyName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>{t("street")}</Label>
                  <Input
                    value={settings.street ?? ""}
                    onChange={(e) => update({ street: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("postalCode")}</Label>
                  <Input
                    value={settings.postalCode ?? ""}
                    onChange={(e) => update({ postalCode: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("city")}</Label>
                  <Input
                    value={settings.city ?? ""}
                    onChange={(e) => update({ city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("countryCode")}</Label>
                  <Input
                    value={settings.countryCode ?? ""}
                    onChange={(e) => update({ countryCode: e.target.value })}
                    placeholder="AT"
                    maxLength={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">{t("logo")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {settings.logoUrl ? (
                  <>
                    <div className="flex h-16 w-32 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={settings.logoUrl}
                        alt="Company logo"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingLogo}
                        onClick={() => logoRef.current?.click()}
                      >
                        {uploadingLogo ? t("saving") : t("logoUpload")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => update({ logoUrl: null })}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        {t("logoRemove")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => logoRef.current?.click()}
                    disabled={uploadingLogo}
                    className="flex h-20 w-full items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <ImagePlus className="h-4 w-4" />
                    {uploadingLogo ? t("saving") : t("logoUpload")}
                  </button>
                )}
              </div>
              <input
                ref={logoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={handleLogoUpload}
              />
            </CardContent>
          </Card>

        </TabsContent>

        {/* ============================================================= */}
        {/* CONFIRMATION TAB                                               */}
        {/* ============================================================= */}
        <TabsContent value="confirmation" className="space-y-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">{t("letterhead")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {uploadingLetterhead ? (
                <div className="flex h-20 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("saving")}
                </div>
              ) : settings.letterheadUrl ? (
                <div className="flex items-center gap-4">
                  <a
                    href={settings.letterheadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-16 w-32 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-2 transition-colors hover:border-slate-300 hover:bg-slate-100"
                  >
                    <FileText className="h-6 w-6 text-emerald-500" />
                    <span className="text-[10px] text-slate-500">PDF</span>
                  </a>
                  <div className="flex flex-col gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => letterheadRef.current?.click()}
                    >
                      {t("letterheadUpload")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => update({ letterheadUrl: null })}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      {t("letterheadRemove")}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => letterheadRef.current?.click()}
                  className="flex h-20 w-full items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-100"
                >
                  <FileText className="h-4 w-4" />
                  {t("letterheadUpload")}
                </button>
              )}
              <p className="text-xs text-slate-500">{t("letterheadHint")}</p>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <input
                ref={letterheadRef}
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={handleLetterheadUpload}
              />
            </CardContent>
          </Card>

          <div className="grid max-w-2xl grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("safeArea")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-slate-500">{t("safeAreaHint")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <MmInput label={t("safeTop")} value={settings.safeTopMm} onChange={(v) => update({ safeTopMm: v })} />
                  <MmInput label={t("safeBottom")} value={settings.safeBottomMm} onChange={(v) => update({ safeBottomMm: v })} />
                  <MmInput label={t("safeLeft")} value={settings.safeLeftMm} onChange={(v) => update({ safeLeftMm: v })} />
                  <MmInput label={t("safeRight")} value={settings.safeRightMm} onChange={(v) => update({ safeRightMm: v })} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("addressWindow")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-slate-500">{t("addressWindowHint")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <MmInput label={t("addressX")} value={settings.addressWindowXMm} onChange={(v) => update({ addressWindowXMm: v })} />
                  <MmInput label={t("addressY")} value={settings.addressWindowYMm} onChange={(v) => update({ addressWindowYMm: v })} />
                  <MmInput label={t("addressWidth")} value={settings.addressWindowWidthMm} onChange={(v) => update({ addressWindowWidthMm: v })} />
                  <MmInput label={t("addressHeight")} value={settings.addressWindowHeightMm} onChange={(v) => update({ addressWindowHeightMm: v })} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">{t("confirmationFont")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select
                value={settings.confirmationFontFamily ?? "__none__"}
                onValueChange={(v) =>
                  update({ confirmationFontFamily: v === "__none__" ? null : v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("noFont")}</SelectItem>
                  {fonts.map((f) => (
                    <SelectItem key={f.id} value={f.slug}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">{t("confirmationFontHint")}</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================= */}
        {/* EMAIL TAB                                                      */}
        {/* ============================================================= */}
        <TabsContent value="email" className="space-y-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">{t("email")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-500">{t("emailHint")}</p>
              <div className="space-y-2">
                <Label>{t("emailBcc")}</Label>
                <Input
                  type="email"
                  value={settings.emailBcc ?? ""}
                  onChange={(e) => update({ emailBcc: e.target.value })}
                  placeholder={t("emailBccPlaceholder")}
                />
                <p className="text-xs text-slate-500">{t("emailBccHint")}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-3">
        <LoadingButton loading={saving} loadingText={t("saving")} onClick={handleSave}>
          {t("save")}
        </LoadingButton>
        {toast && <span className="text-sm text-green-600">{toast}</span>}
      </div>
    </div>
  );
}
