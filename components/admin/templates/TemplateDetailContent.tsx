"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TemplateAssetType } from "@prisma/client";
import { Plus, Trash2, X } from "lucide-react";

import type { AdminTemplateSummary, AdminFontFamily, AdminTemplateFontLink } from "@/lib/admin/templates-data";
import type { AdminBrandSummary } from "@/lib/admin/brands-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "@/components/providers/locale-provider";
import { hasInlineDesignConfig } from "@/lib/template-design";
import { formatDateTime } from "@/lib/formatDateTime";
import { PaperStockSelector } from "./PaperStockSelector";
import { cn } from "@/lib/utils";

const IMAGE_ACCEPT = "image/png,image/svg+xml,image/webp";
const assetUploadFields: Array<{ type: TemplateAssetType; field: "pdf" | "front" | "back"; accept: string }> = [
  { type: TemplateAssetType.PDF, field: "pdf", accept: "application/pdf" },
  { type: TemplateAssetType.PREVIEW_FRONT, field: "front", accept: IMAGE_ACCEPT },
  { type: TemplateAssetType.PREVIEW_BACK, field: "back", accept: IMAGE_ACCEPT },
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
    pcmCode: template.pcmCode ?? "",
    paperStockId: template.paperStock?.id ?? "",
    config: stringifyConfig(template.config),
  }));

  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [brandSearch, setBrandSearch] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [isLinkingBrand, setIsLinkingBrand] = useState(false);
  const [removingBrandId, setRemovingBrandId] = useState<string | null>(null);

  const [fontFamilies, setFontFamilies] = useState<AdminFontFamily[]>([]);
  const [assigningFamilyId, setAssigningFamilyId] = useState<string | null>(null);
  const [removingFamilyId, setRemovingFamilyId] = useState<string | null>(null);
  const [fontSheetOpen, setFontSheetOpen] = useState(false);
  const [fontSheetSearch, setFontSheetSearch] = useState("");
  const [selectedFamilyIdInSheet, setSelectedFamilyIdInSheet] = useState<string>("");
  const [pendingRemovalFamily, setPendingRemovalFamily] = useState<{ id: string; name: string } | null>(null);

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

  const brandResults = useMemo(() => {
    const query = brandSearch.trim().toLowerCase();
    return brandOptions
      .filter((brand) => !assignedBrandIds.has(brand.id))
      .filter((brand) => {
        if (!query) return true;
        return brand.name.toLowerCase().includes(query) || brand.slug.toLowerCase().includes(query);
      });
  }, [brandOptions, brandSearch, assignedBrandIds]);
  const linkedFontsById = useMemo(() => {
    const map = new Map<string, AdminTemplateFontLink>();
    for (const font of template.fonts) {
      map.set(font.fontVariantId, font);
    }
    return map;
  }, [template.fonts]);
  const linkedFamilyMap = useMemo(() => {
    const map = new Map<string, AdminTemplateFontLink[]>();
    for (const font of template.fonts) {
      if (!map.has(font.fontFamilyId)) {
        map.set(font.fontFamilyId, []);
      }
      map.get(font.fontFamilyId)!.push(font);
    }
    return map;
  }, [template.fonts]);
  const linkedFamilies = useMemo(() => {
    return Array.from(linkedFamilyMap.entries())
      .map(([familyId, variants]) => ({
        familyId,
        name: variants[0]?.fontFamilyName ?? "",
        variants,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [linkedFamilyMap]);
  const variantTotals = useMemo(() => {
    const map = new Map<string, number>();
    fontFamilies.forEach((family) => map.set(family.id, family.variants.length));
    return map;
  }, [fontFamilies]);
  const filteredFontFamilies = useMemo(() => {
    const query = fontSheetSearch.trim().toLowerCase();
    if (!query) {
      return fontFamilies;
    }
    return fontFamilies.filter(
      (family) =>
        family.name.toLowerCase().includes(query) || family.slug.toLowerCase().includes(query),
    );
  }, [fontFamilies, fontSheetSearch]);
  const selectedFamilyInSheet = useMemo(() => {
    if (!selectedFamilyIdInSheet) return null;
    return fontFamilies.find((family) => family.id === selectedFamilyIdInSheet) ?? null;
  }, [fontFamilies, selectedFamilyIdInSheet]);
  const selectedFamilyMissingCount = useMemo(() => {
    if (!selectedFamilyInSheet) return 0;
    const assigned = linkedFamilyMap.get(selectedFamilyInSheet.id)?.length ?? 0;
    const total = selectedFamilyInSheet.variants.length;
    return Math.max(total - assigned, 0);
  }, [linkedFamilyMap, selectedFamilyInSheet]);

  useEffect(() => {
    if (!fontSheetOpen) return;
    if (
      selectedFamilyIdInSheet &&
      filteredFontFamilies.some((family) => family.id === selectedFamilyIdInSheet)
    ) {
      return;
    }
    if (filteredFontFamilies.length > 0) {
      setSelectedFamilyIdInSheet(filteredFontFamilies[0].id);
    } else {
      setSelectedFamilyIdInSheet("");
    }
  }, [fontSheetOpen, filteredFontFamilies, selectedFamilyIdInSheet]);

  useEffect(() => {
    setMetadata({
      label: template.label ?? "",
      description: template.description ?? "",
      layoutVersion: template.layoutVersion ? String(template.layoutVersion) : "",
      printDpi: template.printDpi ? String(template.printDpi) : "",
      pcmCode: template.pcmCode ?? "",
      paperStockId: template.paperStock?.id ?? "",
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
    const pcmCodeInput = metadata.pcmCode.trim();
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
          pcmCode: pcmCodeInput || null,
          paperStockId: metadata.paperStockId || null,
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

  const handleFontSheetOpenChange = (open: boolean) => {
    if (!open) {
      setFontSheetSearch("");
      setSelectedFamilyIdInSheet("");
    }
    setFontSheetOpen(open);
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

  const requestFontLink = async (fontVariantId: string) => {
    const response = await fetch(`/api/admin/templates/${template.id}/fonts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fontVariantId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error ?? t("detail.fonts.linkFailed"));
    }
  };

  const requestFontUnlink = async (fontVariantId: string) => {
    const response = await fetch(`/api/admin/templates/${template.id}/fonts`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fontVariantId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error ?? t("detail.fonts.unlinkFailed"));
    }
  };

  const handleAssignFamily = async (familyId: string, options?: { closeSheet?: boolean }) => {
    const family = fontFamilies.find((item) => item.id === familyId);
    if (!family) return;
    const missing = family.variants.filter((variant) => !linkedFontsById.has(variant.id));
    if (missing.length === 0) {
      setMetadataSuccess(t("detail.fonts.familyUpToDate", { name: family.name }));
      if (options?.closeSheet) {
        handleFontSheetOpenChange(false);
      }
      return;
    }

    setAssigningFamilyId(familyId);
    setMetadataError(null);
    setMetadataSuccess(null);
    try {
      for (const variant of missing) {
        await requestFontLink(variant.id);
      }
      setMetadataSuccess(t("detail.fonts.assignSuccess", { name: family.name, count: missing.length }));
      router.refresh();
      if (options?.closeSheet) {
        handleFontSheetOpenChange(false);
      }
    } catch (error) {
      setMetadataError(error instanceof Error ? error.message : t("detail.fonts.linkFailed"));
    } finally {
      setAssigningFamilyId(null);
    }
  };

  const handleAssignSelectedFamily = async () => {
    if (!selectedFamilyInSheet) return;
    await handleAssignFamily(selectedFamilyInSheet.id, { closeSheet: true });
  };

  const handleRemoveFamily = async (familyId: string) => {
    const assigned = linkedFamilyMap.get(familyId) ?? [];
    if (assigned.length === 0) return;
    setRemovingFamilyId(familyId);
    setMetadataError(null);
    setMetadataSuccess(null);
    try {
      for (const variant of assigned) {
        await requestFontUnlink(variant.fontVariantId);
      }
      setMetadataSuccess(t("detail.fonts.unlinkSuccess"));
      router.refresh();
    } catch (error) {
      setMetadataError(error instanceof Error ? error.message : t("detail.fonts.unlinkFailed"));
    } finally {
      setRemovingFamilyId(null);
    }
  };

  const confirmPendingFamilyRemoval = async () => {
    if (!pendingRemovalFamily) return;
    await handleRemoveFamily(pendingRemovalFamily.id);
    setPendingRemovalFamily(null);
  };

  const handleRemovalDialogOpenChange = (open: boolean) => {
    if (!open) {
      if (removingFamilyId) return;
      setPendingRemovalFamily(null);
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
    <>
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
          <div className="space-y-1.5">
            <Label htmlFor="template-pcm-code">{t("create.fields.pcmCode")}</Label>
            <Input
              id="template-pcm-code"
              value={metadata.pcmCode}
              onChange={(event) => {
                setMetadata((current) => ({ ...current, pcmCode: event.target.value }));
                setMetadataSuccess(null);
              }}
              placeholder="pcm_vk_template"
            />
            <p className="text-xs text-slate-500">{t("create.hints.pcmCode")}</p>
          </div>
        <div className="md:col-span-2">
          <PaperStockSelector
            value={metadata.paperStockId}
            onChange={(next) => {
              setMetadata((current) => ({ ...current, paperStockId: next }));
              setMetadataSuccess(null);
            }}
            helperText={t("paperStock.helper")}
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

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{t("detail.fonts.heading")}</h3>
            <p className="text-xs text-slate-500">{t("detail.fonts.description")}</p>
          </div>
          <Button
            type="button"
            onClick={() => handleFontSheetOpenChange(true)}
            className="gap-2 self-start"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("detail.fonts.addButton")}
          </Button>
        </div>
        {linkedFamilies.length === 0 ? (
          <p className="text-xs text-slate-500">{t("detail.fonts.noneLinked")}</p>
        ) : (
          <div className="space-y-3">
            {linkedFamilies.map((family) => {
              const total = variantTotals.get(family.familyId) ?? family.variants.length;
              const missingCount = Math.max(total - family.variants.length, 0);
              const isRemoving = removingFamilyId === family.familyId;
              return (
                <div
                  key={family.familyId}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{family.name}</p>
                      <p className="text-xs text-slate-500">
                        {t("detail.fonts.assignedCount", { count: family.variants.length, total })}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-2 self-start text-red-600 hover:text-red-600"
                      disabled={isRemoving}
                      onClick={() => setPendingRemovalFamily({ id: family.familyId, name: family.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                      {isRemoving ? t("detail.fonts.removeProgress") : t("detail.fonts.removeFamily")}
                    </Button>
                  </div>
                  {family.variants.length > 0 ? (
                    <ul className="mt-4 flex flex-wrap gap-2 text-xs text-slate-700">
                      {family.variants.map((font) => (
                        <li
                          key={font.id}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1"
                        >
                          {font.weight} / {font.style.toLowerCase()} · {font.format}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-xs text-slate-500">{t("detail.fonts.noneLinked")}</p>
                  )}
                  {missingCount > 0 ? (
                    <p className="mt-2 text-xs text-amber-600">
                      {t("detail.fonts.missingVariants", { count: missingCount })}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
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

      <Dialog open={fontSheetOpen} onOpenChange={handleFontSheetOpenChange}>
        <DialogContent className="flex h-[80vh] flex-col overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-4 text-left">
            <DialogTitle>{t("detail.fonts.picker.title")}</DialogTitle>
            <DialogDescription>{t("detail.fonts.picker.description")}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <Input
              placeholder={t("detail.fonts.picker.searchPlaceholder")}
              value={fontSheetSearch}
              onChange={(event) => setFontSheetSearch(event.target.value)}
            />
            <div className="mt-4 space-y-2">
              {filteredFontFamilies.length === 0 ? (
                <p className="text-sm text-slate-500">{t("detail.fonts.picker.empty")}</p>
              ) : (
                filteredFontFamilies.map((family) => {
                  const assigned = linkedFamilyMap.get(family.id)?.length ?? 0;
                  const total = family.variants.length;
                  const missing = Math.max(total - assigned, 0);
                  const isSelected = selectedFamilyIdInSheet === family.id;
                  return (
                    <button
                      key={family.id}
                      type="button"
                      onClick={() => setSelectedFamilyIdInSheet(family.id)}
                      className={cn(
                        "w-full rounded-lg border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
                        isSelected ? "border-slate-900 bg-slate-50 shadow-sm" : "border-slate-200 hover:border-slate-300",
                      )}
                    >
                      <div className="flex flex-col gap-1">
                        <FontPreviewName
                          family={family}
                          enabled={fontSheetOpen}
                          className="text-sm"
                        />
                        <p className="text-xs text-slate-500">
                          {t("detail.fonts.assignedCount", { count: assigned, total })}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {missing === 0 ? (
                          <Badge variant="secondary">{t("detail.fonts.picker.assigned")}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600">
                            {t("detail.fonts.picker.missing", { count: missing })}
                          </Badge>
                        )}
                      </div>
                      {family.variants.length === 0 ? (
                        <p className="mt-2 text-xs text-slate-500">{t("detail.fonts.picker.noVariants")}</p>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleFontSheetOpenChange(false)}
                disabled={assigningFamilyId !== null}
              >
                {t("detail.fonts.picker.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleAssignSelectedFamily}
                disabled={
                  !selectedFamilyInSheet || selectedFamilyMissingCount === 0 || assigningFamilyId !== null
                }
              >
                {assigningFamilyId
                  ? t("detail.fonts.assignProgress")
                  : !selectedFamilyInSheet
                    ? t("detail.fonts.picker.actionDisabled")
                    : selectedFamilyMissingCount === 0
                      ? t("detail.fonts.picker.assigned")
                      : t("detail.fonts.picker.action")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingRemovalFamily)} onOpenChange={handleRemovalDialogOpenChange}>
        <DialogContent className="max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle>{t("detail.fonts.removeDialogTitle", { name: pendingRemovalFamily?.name ?? "" })}</DialogTitle>
            <DialogDescription>{t("detail.fonts.removeDialogDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPendingRemovalFamily(null)}
              disabled={Boolean(removingFamilyId)}
            >
              {t("detail.fonts.removeDialogCancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmPendingFamilyRemoval}
              disabled={!pendingRemovalFamily || removingFamilyId === pendingRemovalFamily.id}
            >
              {removingFamilyId === pendingRemovalFamily?.id
                ? t("detail.fonts.removeProgress")
                : t("detail.fonts.removeDialogConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
  return formatDateTime(iso, "de-AT", {
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

type FontPreviewNameProps = {
  family: AdminFontFamily;
  enabled: boolean;
  className?: string;
};

function FontPreviewName({ family, enabled, className }: FontPreviewNameProps) {
  useEffect(() => {
    if (!enabled) return;
    void loadFontPreviewFace(family);
  }, [family, enabled]);

  return (
    <span
      className={cn("font-semibold text-slate-900", className)}
      style={enabled ? { fontFamily: `"${family.name}", var(--font-heading, var(--font-sans))` } : undefined}
    >
      {family.name}
    </span>
  );
}

const FONT_PREVIEW_PRIORITY: Array<AdminFontFamily["variants"][number]["format"]> = [
  "WOFF2",
  "WOFF",
  "OTF",
  "TTF",
];

const fontPreviewLoaders = new Map<string, Promise<void>>();

function pickPreviewVariant(family: AdminFontFamily) {
  if (!family.variants.length) return null;
  for (const format of FONT_PREVIEW_PRIORITY) {
    const variant = family.variants.find((item) => item.format === format);
    if (variant) return variant;
  }
  return family.variants[0];
}

async function loadFontPreviewFace(family: AdminFontFamily) {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof FontFace === "undefined") {
    return;
  }
  const variant = pickPreviewVariant(family);
  if (!variant?.storageKey) return;
  const cacheKey = `${family.id}:${variant.storageKey}:${variant.updatedAt}`;
  if (fontPreviewLoaders.has(cacheKey)) {
    return fontPreviewLoaders.get(cacheKey);
  }
  const loader = (async () => {
    const response = await fetch(
      `/api/admin/templates/fonts/url?storageKey=${encodeURIComponent(variant.storageKey)}`,
    );
    if (!response.ok) {
      throw new Error(`Failed to sign preview font ${variant.storageKey}`);
    }
    const data = (await response.json().catch(() => null)) as { url?: string } | null;
    const url = data?.url;
    if (!url) return;
    const face = new FontFace(family.name, `url(${url})`, {
      weight: variant.weight ? String(variant.weight) : undefined,
      style: variant.style === "ITALIC" ? "italic" : "normal",
    });
    await face.load();
    document.fonts.add(face);
  })().catch((error) => {
    console.warn("[admin] failed to load font preview", error);
  });
  fontPreviewLoaders.set(cacheKey, loader);
  return loader;
}
