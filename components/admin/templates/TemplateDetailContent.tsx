"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TemplateAssetType } from "@prisma/client";
import { FileWarning, Trash2, X } from "lucide-react";

import type { AdminTemplateSummary, AdminFontFamily } from "@/lib/admin/templates-data";
import type { AdminBrandSummary } from "@/lib/admin/brands-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "@/components/providers/locale-provider";
import { hasInlineDesignConfig } from "@/lib/template-design";

const assetUploadFields: Array<{ type: TemplateAssetType; field: "pdf" | "front" | "back"; accept: string }> = [
  { type: TemplateAssetType.PDF, field: "pdf", accept: "application/pdf" },
  { type: TemplateAssetType.PREVIEW_FRONT, field: "front", accept: "image/png,image/svg+xml" },
  { type: TemplateAssetType.PREVIEW_BACK, field: "back", accept: "image/png,image/svg+xml" },
];

const assetOverviewTypes: TemplateAssetType[] = [
  TemplateAssetType.PDF,
  TemplateAssetType.PREVIEW_FRONT,
  TemplateAssetType.PREVIEW_BACK,
  TemplateAssetType.CONFIG,
];

type Props = {
  template: AdminTemplateSummary;
  onDelete?: (templateId: string) => Promise<void>;
};

type BrandOption = Pick<AdminBrandSummary, "id" | "name" | "slug">;

type FontVariantOption = {
  id: string;
  variantId: string;
  label: string;
};

export default function TemplateDetailContent({ template, onDelete }: Props) {
  const router = useRouter();
  const t = useTranslations("admin.templates");

  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [metadataSuccess, setMetadataSuccess] = useState<string | null>(null);
  const [metadata, setMetadata] = useState(() => ({
    label: template.label ?? "",
    description: template.description ?? "",
    layoutVersion: template.layoutVersion ? String(template.layoutVersion) : "",
    printDpi: template.printDpi ? String(template.printDpi) : "",
    config: stringifyConfig(template.config),
  }));

  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [brandSearch, setBrandSearch] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [isLinkingBrand, setIsLinkingBrand] = useState(false);
  const [removingBrandId, setRemovingBrandId] = useState<string | null>(null);

  const [fontFamilies, setFontFamilies] = useState<AdminFontFamily[]>([]);
  const [fontSearch, setFontSearch] = useState("");
  const [selectedFontVariantId, setSelectedFontVariantId] = useState<string>("");
  const [isLinkingFont, setIsLinkingFont] = useState(false);
  const [removingFontVariantId, setRemovingFontVariantId] = useState<string | null>(null);

  const [assetFiles, setAssetFiles] = useState<{ pdf: File | null; front: File | null; back: File | null }>({
    pdf: null,
    front: null,
    back: null,
  });
  const [isUploadingAssets, setIsUploadingAssets] = useState(false);
  const [assetMessage, setAssetMessage] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const inlineDesign = useMemo(() => hasInlineDesignConfig(template.config), [template.config]);

  const assignedBrandIds = useMemo(
    () => new Set(template.brandAssignments.map((assignment) => assignment.brandId)),
    [template.brandAssignments],
  );
  const assignedFontVariantIds = useMemo(
    () => new Set(template.fonts.map((font) => font.fontVariantId)),
    [template.fonts],
  );

  const brandResults = useMemo(() => {
    const query = brandSearch.trim().toLowerCase();
    return brandOptions
      .filter((brand) => !assignedBrandIds.has(brand.id))
      .filter((brand) => {
        if (!query) return true;
        return brand.name.toLowerCase().includes(query) || brand.slug.toLowerCase().includes(query);
      });
  }, [brandOptions, brandSearch, assignedBrandIds]);

  const fontOptions = useMemo<FontVariantOption[]>(() => {
    const options: FontVariantOption[] = [];
    for (const family of fontFamilies) {
      for (const variant of family.variants) {
        options.push({
          id: `${family.id}-${variant.id}`,
          variantId: variant.id,
          label: `${family.name} • ${variant.weight} / ${variant.style.toLowerCase()} / ${variant.format}`,
        });
      }
    }
    return options;
  }, [fontFamilies]);

  const fontResults = useMemo(() => {
    const query = fontSearch.trim().toLowerCase();
    return fontOptions
      .filter((option) => !assignedFontVariantIds.has(option.variantId))
      .filter((option) => (query ? option.label.toLowerCase().includes(query) : true));
  }, [fontOptions, fontSearch, assignedFontVariantIds]);

  useEffect(() => {
    setMetadata({
      label: template.label ?? "",
      description: template.description ?? "",
      layoutVersion: template.layoutVersion ? String(template.layoutVersion) : "",
      printDpi: template.printDpi ? String(template.printDpi) : "",
      config: stringifyConfig(template.config),
    });
    setMetadataError(null);
    setMetadataSuccess(null);
    setAssetMessage(null);
    setAssetError(null);
  }, [template]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/brands", { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { brands?: AdminBrandSummary[] }) => {
        if (!data?.brands) return;
        setBrandOptions(data.brands.map((brand) => ({ id: brand.id, name: brand.name, slug: brand.slug })));
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Failed to load brands", error);
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/fonts", { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { families?: AdminFontFamily[] }) => {
        if (!data?.families) return;
        setFontFamilies(data.families);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Failed to load font families", error);
        }
      });
    return () => controller.abort();
  }, []);

  const handleSaveMetadata: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setMetadataError(null);
    setMetadataSuccess(null);

    const label = metadata.label.trim();
    if (!label) {
      setMetadataError(t("detail.errors.labelRequired"));
      return;
    }

    const layoutVersionInput = metadata.layoutVersion.trim();
    const printDpiInput = metadata.printDpi.trim();
    let layoutVersion: number | null = null;
    let printDpi: number | null = null;

    if (layoutVersionInput) {
      const parsed = Number.parseInt(layoutVersionInput, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setMetadataError(t("detail.errors.layoutVersionInvalid"));
        return;
      }
      layoutVersion = parsed;
    }

    if (printDpiInput) {
      const parsed = Number.parseInt(printDpiInput, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setMetadataError(t("detail.errors.printDpiInvalid"));
        return;
      }
      printDpi = parsed;
    }

    let parsedConfig: unknown;
    try {
      parsedConfig = JSON.parse(metadata.config);
    } catch {
      setMetadataError(t("detail.configInvalid"));
      return;
    }

    setIsSavingMetadata(true);
    try {
      const response = await fetch(`/api/admin/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          description: metadata.description.trim(),
          layoutVersion,
          printDpi,
          config: parsedConfig,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? t("detail.saveFailed"));
      }

      setMetadataSuccess(t("detail.saveSuccess"));
      router.refresh();
    } catch (error) {
      setMetadataError(error instanceof Error ? error.message : t("detail.saveFailed"));
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleLinkBrand = async () => {
    if (!selectedBrandId) return;
    setIsLinkingBrand(true);
    setMetadataSuccess(null);
    setMetadataError(null);

    try {
      const response = await fetch(`/api/admin/templates/${template.id}/brands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: selectedBrandId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? t("detail.brands.linkFailed"));
      }
      setSelectedBrandId("");
      setMetadataSuccess(t("detail.brands.linkSuccess"));
      router.refresh();
    } catch (error) {
      setMetadataError(error instanceof Error ? error.message : t("detail.brands.linkFailed"));
    } finally {
      setIsLinkingBrand(false);
    }
  };

  const handleRemoveBrand = async (brandId: string) => {
    setRemovingBrandId(brandId);
    setMetadataError(null);
    setMetadataSuccess(null);
    try {
      const response = await fetch(`/api/admin/templates/${template.id}/brands`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? t("detail.brands.unlinkFailed"));
      }
      setMetadataSuccess(t("detail.brands.unlinkSuccess"));
      router.refresh();
    } catch (error) {
      setMetadataError(error instanceof Error ? error.message : t("detail.brands.unlinkFailed"));
    } finally {
      setRemovingBrandId(null);
    }
  };

  const handleLinkFont = async () => {
    if (!selectedFontVariantId) return;
    setIsLinkingFont(true);
    setMetadataSuccess(null);
    setMetadataError(null);
    try {
      const response = await fetch(`/api/admin/templates/${template.id}/fonts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fontVariantId: selectedFontVariantId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? t("detail.fonts.linkFailed"));
      }
      setSelectedFontVariantId("");
      setMetadataSuccess(t("detail.fonts.linkSuccess"));
      router.refresh();
    } catch (error) {
      setMetadataError(error instanceof Error ? error.message : t("detail.fonts.linkFailed"));
    } finally {
      setIsLinkingFont(false);
    }
  };

  const handleRemoveFont = async (fontVariantId: string) => {
    setRemovingFontVariantId(fontVariantId);
    setMetadataError(null);
    setMetadataSuccess(null);
    try {
      const response = await fetch(`/api/admin/templates/${template.id}/fonts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fontVariantId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? t("detail.fonts.unlinkFailed"));
      }
      setMetadataSuccess(t("detail.fonts.unlinkSuccess"));
      router.refresh();
    } catch (error) {
      setMetadataError(error instanceof Error ? error.message : t("detail.fonts.unlinkFailed"));
    } finally {
      setRemovingFontVariantId(null);
    }
  };

  const handleUploadAssets = async () => {
    const filesToUpload: Array<{ type: TemplateAssetType; field: "pdf" | "front" | "back"; file: File }> = [];
    for (const item of assetUploadFields) {
      const file = assetFiles[item.field];
      if (file) {
        filesToUpload.push({ type: item.type, field: item.field, file });
      }
    }

    if (filesToUpload.length === 0) {
      setAssetError(t("detail.assets.noFiles"));
      setAssetMessage(null);
      return;
    }

    setAssetError(null);
    setAssetMessage(null);
    setIsUploadingAssets(true);

    try {
      for (const item of filesToUpload) {
        const formData = new FormData();
        formData.append("templateKey", template.key);
        formData.append("version", String(nextAssetVersionForType(template, item.type)));
        formData.append("assetType", toAssetTypeKey(item.type));
        formData.append("file", item.file);

        const response = await fetch("/api/admin/templates/assets", {
          method: "POST",
          body: formData,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error ?? t("detail.assets.uploadFailed"));
        }
      }

      setAssetFiles({ pdf: null, front: null, back: null });
      setAssetMessage(t("detail.assets.uploadSuccess"));
      router.refresh();
    } catch (error) {
      setAssetError(error instanceof Error ? error.message : t("detail.assets.uploadFailed"));
    } finally {
      setIsUploadingAssets(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!onDelete) return;
    if (!confirm(t("detail.deleteConfirm", { template: template.label }))) return;
    try {
      setIsDeleting(true);
      await onDelete(template.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("detail.deleteFailed");
      alert(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSaveMetadata} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="template-key">{t("create.fields.key")}</Label>
            <Input id="template-key" value={template.key} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-label">{t("create.fields.label")}</Label>
            <Input
              id="template-label"
              value={metadata.label}
              onChange={(event) => {
                setMetadata((current) => ({ ...current, label: event.target.value }));
                setMetadataSuccess(null);
              }}
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="template-description">{t("create.fields.description")}</Label>
            <Textarea
              id="template-description"
              value={metadata.description}
              onChange={(event) => {
                setMetadata((current) => ({ ...current, description: event.target.value }));
                setMetadataSuccess(null);
              }}
              rows={3}
              placeholder={t("create.placeholders.description")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-layout-version">{t("create.fields.layoutVersion")}</Label>
            <Input
              id="template-layout-version"
              type="number"
              min={0}
              value={metadata.layoutVersion}
              onChange={(event) => {
                setMetadata((current) => ({ ...current, layoutVersion: event.target.value }));
                setMetadataSuccess(null);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-print-dpi">{t("create.fields.printDpi")}</Label>
            <Input
              id="template-print-dpi"
              type="number"
              min={0}
              value={metadata.printDpi}
              onChange={(event) => {
                setMetadata((current) => ({ ...current, printDpi: event.target.value }));
                setMetadataSuccess(null);
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="template-config">{t("create.fields.config")}</Label>
          <Textarea
            id="template-config"
            value={metadata.config}
            onChange={(event) => {
              setMetadata((current) => ({ ...current, config: event.target.value }));
              setMetadataSuccess(null);
            }}
            rows={12}
            className="font-mono text-xs"
          />
          <p className="text-xs text-slate-500">{t("create.hints.config")}</p>
        </div>

        {metadataError ? <p className="text-sm text-red-600">{metadataError}</p> : null}
        {metadataSuccess ? <p className="text-sm text-emerald-600">{metadataSuccess}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="submit" disabled={isSavingMetadata}>
            {isSavingMetadata ? t("detail.saving") : t("detail.saveButton")}
          </Button>
        </div>
      </form>

      <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">{t("detail.assets.uploadHeading")}</h3>
          <p className="text-xs text-slate-500">{t("detail.assets.uploadDescription")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {assetUploadFields.map((item) => (
            <div key={item.type} className="space-y-1.5">
              <Label htmlFor={`asset-${item.field}`}>{t(`detail.assets.fields.${item.field}` as any)}</Label>
              <Input
                id={`asset-${item.field}`}
                type="file"
                accept={item.accept}
                onChange={(event) =>
                  setAssetFiles((current) => ({
                    ...current,
                    [item.field]: event.target.files?.[0] ?? null,
                  }))
                }
              />
              {assetFiles[item.field] ? (
                <p className="text-xs text-slate-500 truncate">{assetFiles[item.field]?.name}</p>
              ) : null}
            </div>
          ))}
        </div>
        {assetError ? <p className="text-xs text-red-600">{assetError}</p> : null}
        {assetMessage ? <p className="text-xs text-emerald-600">{assetMessage}</p> : null}
        <Button onClick={handleUploadAssets} disabled={isUploadingAssets} className="sm:w-fit">
          {isUploadingAssets ? t("detail.assets.uploading") : t("detail.assets.uploadButton")}
        </Button>
      </div>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">{t("detail.brands.heading")}</h3>
          <p className="text-xs text-slate-500">{t("detail.brands.description")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <Input
              placeholder={t("detail.brands.searchPlaceholder")}
              value={brandSearch}
              onChange={(event) => setBrandSearch(event.target.value)}
            />
            <Select value={selectedBrandId || undefined} onValueChange={setSelectedBrandId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("detail.brands.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {brandResults.length === 0 ? (
                  <SelectItem value="__no_options" disabled>
                    {t("detail.brands.empty")}
                  </SelectItem>
                ) : (
                  brandResults.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="sm:self-end"
            type="button"
            onClick={handleLinkBrand}
            disabled={!selectedBrandId || isLinkingBrand}
          >
            {isLinkingBrand ? t("detail.brands.linkProgress") : t("detail.brands.linkButton")}
          </Button>
        </div>
        {template.brandAssignments.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-xs text-slate-600">
            {template.brandAssignments.map((assignment) => (
              <li key={assignment.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                <span>{assignment.brandName}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleRemoveBrand(assignment.brandId)}
                  disabled={removingBrandId === assignment.brandId}
                  type="button"
                >
                  <X className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">{t("detail.brands.none")}</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">{t("detail.fonts.assignHeading")}</h3>
          <p className="text-xs text-slate-500">{t("detail.fonts.assignDescription")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <Input
              placeholder={t("detail.fonts.searchPlaceholder")}
              value={fontSearch}
              onChange={(event) => setFontSearch(event.target.value)}
            />
            <Select value={selectedFontVariantId || undefined} onValueChange={setSelectedFontVariantId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("detail.fonts.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {fontResults.length === 0 ? (
                  <SelectItem value="__no_fonts" disabled>
                    {t("detail.fonts.empty")}
                  </SelectItem>
                ) : (
                  fontResults.map((option) => (
                    <SelectItem key={option.id} value={option.variantId}>
                      {option.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="sm:self-end"
            type="button"
            onClick={handleLinkFont}
            disabled={!selectedFontVariantId || isLinkingFont}
          >
            {isLinkingFont ? t("detail.fonts.linkProgress") : t("detail.fonts.linkButton")}
          </Button>
        </div>

        {template.fonts.length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-xs text-slate-600">
            {template.fonts.map((font) => (
              <li key={font.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                <span>
                  {font.fontFamilyName} • {font.weight} / {font.style.toLowerCase()} / {font.format}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleRemoveFont(font.fontVariantId)}
                  disabled={removingFontVariantId === font.fontVariantId}
                  type="button"
                >
                  <X className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">{t("detail.fontsEmpty")}</p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">{t("detail.assetsHeading")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {assetOverviewTypes.map((type) => {
            const asset = template.assets.find((item) => item.type === type);
            const label = t(`assetTypes.${type}` as any);
            const isConfig = type === TemplateAssetType.CONFIG;
            const hasInline = isConfig ? inlineDesign : false;
            const missing = isConfig ? !asset && !hasInline : !asset;
            const hasAssetMeta = Boolean(asset);
            const description = isConfig
              ? hasAssetMeta
                ? t("detail.assetMeta", { version: asset?.version ?? 1, updated: formatDate(asset!.updatedAt) })
                : hasInline
                  ? t("detail.configInline")
                  : t("detail.missingAsset")
              : missing
                ? t("detail.missingAsset")
                : t("detail.assetMeta", { version: asset?.version ?? 1, updated: formatDate(asset!.updatedAt) });
            return (
              <Card key={type} className={missing ? "border-dashed border-amber-500 bg-amber-50/40 text-amber-700" : ""}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  {isConfig && hasInline && !asset ? (
                    <p className="text-xs text-slate-500">{t("detail.configInlineDescription")}</p>
                  ) : (
                    <div className="flex flex-col text-xs text-slate-500">
                      <span>
                        {t("detail.fileLabel")}: {asset?.fileName ?? "–"}
                      </span>
                      <span>
                        {t("detail.sizeLabel")}: {formatBytes(asset?.sizeBytes ?? null)}
                      </span>
                    </div>
                  )}
                  {missing ? <FileWarning className="size-5 text-amber-500" /> : null}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {template.assets.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">{t("detail.tableHeaders.version")}</th>
                  <th className="px-4 py-2 text-left font-semibold">{t("detail.tableHeaders.type")}</th>
                  <th className="px-4 py-2 text-left font-semibold">{t("detail.tableHeaders.file")}</th>
                  <th className="px-4 py-2 text-left font-semibold">{t("detail.tableHeaders.size")}</th>
                  <th className="px-4 py-2 text-left font-semibold">{t("detail.tableHeaders.updated")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {template.assets.map((asset) => (
                  <tr key={asset.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">v{asset.version}</td>
                    <td className="px-4 py-2">{t(`assetTypes.${asset.type}` as any)}</td>
                    <td className="px-4 py-2">{asset.fileName ?? "–"}</td>
                    <td className="px-4 py-2">{formatBytes(asset.sizeBytes)}</td>
                    <td className="px-4 py-2">{formatDate(asset.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {onDelete ? (
        <div className="flex justify-end border-t border-slate-200 pt-4">
          <Button variant="destructive" disabled={isDeleting} onClick={handleDeleteTemplate} className="gap-2">
            <Trash2 className="size-4" />
            {t("detail.deleteButton")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function stringifyConfig(value: unknown) {
  try {
    if (value === null || value === undefined) {
      return "{}";
    }
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function formatBytes(bytes: number | null) {
  if (!bytes || Number.isNaN(bytes)) return "–";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("de-AT", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nextAssetVersionForType(template: AdminTemplateSummary, type: TemplateAssetType) {
  const assets = template.assets.filter((asset) => asset.type === type);
  if (assets.length === 0) return 1;
  return Math.max(...assets.map((asset) => asset.version)) + 1;
}

function toAssetTypeKey(type: TemplateAssetType) {
  switch (type) {
    case TemplateAssetType.PDF:
      return "pdf";
    case TemplateAssetType.PREVIEW_FRONT:
      return "preview_front";
    case TemplateAssetType.PREVIEW_BACK:
      return "preview_back";
    case TemplateAssetType.CONFIG:
      return "config";
    default:
      return type.toLowerCase();
  }
}
