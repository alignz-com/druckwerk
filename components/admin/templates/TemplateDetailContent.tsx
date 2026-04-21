"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

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

type TemplateAddressEntry = {
  id: string;
  label: string | null;
  company: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
};

type TemplateAddressBrandGroup = {
  brandId: string;
  brandName: string;
  addresses: TemplateAddressEntry[];
  assignedAddressIds: string[];
};

const ADDRESS_CACHE_TTL_MS = 30_000;
const addressLoadCache = new Map<string, { data: TemplateAddressBrandGroup[]; timestamp: number }>();
const addressLoadInFlight = new Set<string>();


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
    productId: template.productId ?? "",
    productFormatId: template.productFormatId ?? "",
    config: stringifyConfig(template.config),
    hasQrCode: template.hasQrCode,
    hasPhotoSlot: template.hasPhotoSlot,
    pcmCode: template.pcmCode ?? "",
    paperStockId: template.paperStockId ?? "",
  }));

  const [productOptions, setProductOptions] = useState<{ id: string; name: string; type: string }[]>([]);
  useEffect(() => {
    fetch("/api/admin/products")
      .then((r) => r.json())
      .then((data) => setProductOptions(data))
      .catch(() => {});
  }, []);

  type FormatOption = { id: string; format: { name: string; trimWidthMm: number; trimHeightMm: number }; canvasWidthMm: number | null; canvasHeightMm: number | null; printDpi: number | null; pcmCode: string | null };
  const [formatOptions, setFormatOptions] = useState<FormatOption[]>([]);
  useEffect(() => {
    if (!metadata.productId) {
      setFormatOptions([]);
      return;
    }
    fetch(`/api/admin/products/${metadata.productId}/formats`)
      .then((r) => r.json())
      .then((data: FormatOption[]) => setFormatOptions(data))
      .catch(() => setFormatOptions([]));
  }, [metadata.productId]);

  // Paper options for the selected product format
  type PaperStockOption = { id: string; paperStockId: string; name: string; finish: string | null; weightGsm: number | null };
  const [paperOptions, setPaperOptions] = useState<PaperStockOption[]>([]);
  useEffect(() => {
    if (!metadata.productFormatId) {
      setPaperOptions([]);
      return;
    }
    fetch(`/api/admin/product-formats/${metadata.productFormatId}/papers`)
      .then((r) => r.json())
      .then((data: any[]) =>
        setPaperOptions(data.map((p) => ({
          id: p.id,
          paperStockId: p.paperStockId ?? p.paperStock?.id ?? p.id,
          name: p.paperStock?.name ?? p.name ?? "?",
          finish: p.paperStock?.finish ?? null,
          weightGsm: p.paperStock?.weightGsm ?? null,
        }))),
      )
      .catch(() => setPaperOptions([]));
  }, [metadata.productFormatId]);

  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [brandSearch, setBrandSearch] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [isLinkingBrand, setIsLinkingBrand] = useState(false);
  const [removingBrandId, setRemovingBrandId] = useState<string | null>(null);

  const [addressGroups, setAddressGroups] = useState<TemplateAddressBrandGroup[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressSuccess, setAddressSuccess] = useState<string | null>(null);
  const [savingAddressesByBrand, setSavingAddressesByBrand] = useState<Record<string, boolean>>({});
  const lastAddressLoadKey = useRef<string>("");
  const lastAddressLoadAttemptKey = useRef<string>("");

  const loadTemplateAddresses = useCallback(
    async (loadKey: string, signal: AbortSignal, force = false) => {
      if (!force && lastAddressLoadAttemptKey.current === loadKey) {
        return;
      }
      lastAddressLoadAttemptKey.current = loadKey;
      const cached = addressLoadCache.get(loadKey);
      if (cached && Date.now() - cached.timestamp < ADDRESS_CACHE_TTL_MS) {
        setAddressGroups(cached.data);
        lastAddressLoadKey.current = loadKey;
        return;
      }
      if (addressLoadInFlight.has(loadKey)) {
        return;
      }
      addressLoadInFlight.add(loadKey);
      setIsLoadingAddresses(true);
      setAddressError(null);
      setAddressSuccess(null);
      try {
        const response = await fetch(`/api/admin/templates/${template.id}/addresses`, { signal });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error ?? t("detail.addresses.loadFailed"));
        }
        const data = (await response.json()) as { brands?: TemplateAddressBrandGroup[] };
        if (signal.aborted) return;
        const resolved = data.brands ?? [];
        setAddressGroups(resolved);
        addressLoadCache.set(loadKey, { data: resolved, timestamp: Date.now() });
        lastAddressLoadKey.current = loadKey;
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.error("Failed to load template addresses", error);
          setAddressError(t("detail.addresses.loadFailed"));
        }
      } finally {
        addressLoadInFlight.delete(loadKey);
        setIsLoadingAddresses(false);
      }
    },
    [template.id, t],
  );
  const brandAssignmentKey = useMemo(() => {
    if (template.brandAssignments.length === 0) return "";
    return template.brandAssignments
      .map((assignment) => assignment.brandId)
      .sort()
      .join("|");
  }, [template.brandAssignments]);

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
      .map(([familyId, variants]) => {
        const fullFamily = fontFamilies.find((family) => family.id === familyId) ?? null;
        return {
          familyId,
          name: fullFamily?.name ?? variants[0]?.fontFamilyName ?? "",
          variants,
          fullFamily,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [linkedFamilyMap, fontFamilies]);
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
      productId: template.productId ?? "",
      productFormatId: template.productFormatId ?? "",
      config: stringifyConfig(template.config),
      hasQrCode: template.hasQrCode,
      hasPhotoSlot: template.hasPhotoSlot,
      pcmCode: (template as any).pcmCode ?? "",
      paperStockId: template.paperStockId ?? "",
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
    if (template.brandAssignments.length === 0) {
      setAddressGroups([]);
      setIsLoadingAddresses(false);
      return;
    }
    const loadKey = `${template.id}:${brandAssignmentKey}`;
    if (lastAddressLoadKey.current === loadKey || lastAddressLoadAttemptKey.current === loadKey) {
      return;
    }
    const controller = new AbortController();
    void loadTemplateAddresses(loadKey, controller.signal);
    return () => controller.abort();
  }, [template.id, brandAssignmentKey, t, template.brandAssignments.length, loadTemplateAddresses]);

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
          productId: metadata.productId || null,
          productFormatId: metadata.productFormatId || null,
          config: parsedConfig,
          hasQrCode: metadata.hasQrCode,
          hasPhotoSlot: metadata.hasPhotoSlot,
          pcmCode: metadata.pcmCode.trim() || null,
          paperStockId: metadata.paperStockId || null,
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

  const handleToggleAddress = (brandId: string, addressId: string, checked: boolean | string) => {
    const isChecked = checked === true;
    setAddressSuccess(null);
    setAddressError(null);
    setAddressGroups((current) =>
      current.map((group) => {
        if (group.brandId !== brandId) return group;
        const nextIds = new Set(group.assignedAddressIds);
        if (isChecked) {
          nextIds.add(addressId);
        } else {
          nextIds.delete(addressId);
        }
        return { ...group, assignedAddressIds: Array.from(nextIds) };
      }),
    );
  };

  const handleSaveAddresses = async (brandId: string) => {
    const group = addressGroups.find((entry) => entry.brandId === brandId);
    if (!group) return;
    setSavingAddressesByBrand((current) => ({ ...current, [brandId]: true }));
    setAddressError(null);
    setAddressSuccess(null);
    try {
      const response = await fetch(`/api/admin/templates/${template.id}/addresses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, addressIds: group.assignedAddressIds }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? t("detail.addresses.saveFailed"));
      }
      setAddressSuccess(t("detail.addresses.saveSuccess"));
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : t("detail.addresses.saveFailed"));
    } finally {
      setSavingAddressesByBrand((current) => ({ ...current, [brandId]: false }));
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
          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-white/80 p-4">
            <div className="flex items-start gap-4">
              <Checkbox
                id="template-has-qr"
                checked={metadata.hasQrCode}
                onCheckedChange={(checked) => {
                  setMetadata((current) => ({ ...current, hasQrCode: Boolean(checked) }));
                  setMetadataSuccess(null);
                }}
                aria-describedby="template-has-qr-hint"
              />
              <div className="space-y-1">
                <Label htmlFor="template-has-qr" className="text-sm font-medium text-slate-900">
                  {t("detail.hasQrCodeLabel")}
                </Label>
                <p id="template-has-qr-hint" className="text-xs text-slate-500">
                  {t("detail.hasQrCodeHint")}
                </p>
              </div>
            </div>
          </div>
          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-white/80 p-4">
            <div className="flex items-start gap-4">
              <Checkbox
                id="template-has-photo"
                checked={metadata.hasPhotoSlot}
                onCheckedChange={(checked) => {
                  setMetadata((current) => ({ ...current, hasPhotoSlot: Boolean(checked) }));
                  setMetadataSuccess(null);
                }}
                aria-describedby="template-has-photo-hint"
              />
              <div className="space-y-1">
                <Label htmlFor="template-has-photo" className="text-sm font-medium text-slate-900">
                  {t("detail.hasPhotoSlotLabel")}
                </Label>
                <p id="template-has-photo-hint" className="text-xs text-slate-500">
                  {t("detail.hasPhotoSlotHint")}
                </p>
              </div>
            </div>
          </div>
        <div className="md:col-span-2 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="template-product">Product</Label>
            <Select
              value={metadata.productId || "none"}
              onValueChange={(v) => {
                setMetadata((c) => ({ ...c, productId: v === "none" ? "" : v, productFormatId: "" }));
                setMetadataSuccess(null);
              }}
            >
              <SelectTrigger id="template-product">
                <SelectValue placeholder="No product linked" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No product linked</SelectItem>
                {productOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.type === "TEMPLATE" ? "Template" : "Upload"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {metadata.productId && (
            <div className="space-y-1.5">
              <Label htmlFor="template-product-format">Format</Label>
              <Select
                value={metadata.productFormatId || "none"}
                onValueChange={(v) => {
                  setMetadata((c) => ({ ...c, productFormatId: v === "none" ? "" : v }));
                  setMetadataSuccess(null);
                }}
              >
                <SelectTrigger id="template-product-format">
                  <SelectValue placeholder="No format selected" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No format selected</SelectItem>
                  {formatOptions.map((pf) => (
                    <SelectItem key={pf.id} value={pf.id}>
                      {pf.format.name} ({pf.format.trimWidthMm} × {pf.format.trimHeightMm} mm)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(() => {
                const selected = formatOptions.find((pf) => pf.id === metadata.productFormatId);
                if (!selected) return null;
                return (
                  <p className="text-xs text-muted-foreground">
                    {selected.format.trimWidthMm} × {selected.format.trimHeightMm} mm trim
                    {selected.canvasWidthMm ? `, canvas ${selected.canvasWidthMm} × ${selected.canvasHeightMm} mm` : ""}
                    {selected.printDpi ? `, ${selected.printDpi} DPI` : ""}
                    {selected.pcmCode ? `, PCM: ${selected.pcmCode}` : ""}
                  </p>
                );
              })()}
            </div>
          )}

          {paperOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="template-paper">Paper</Label>
              <Select
                value={metadata.paperStockId || "none"}
                onValueChange={(v) => {
                  setMetadata((c) => ({ ...c, paperStockId: v === "none" ? "" : v }));
                  setMetadataSuccess(null);
                }}
              >
                <SelectTrigger id="template-paper">
                  <SelectValue placeholder="No paper selected" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No paper selected</SelectItem>
                  {paperOptions.map((p) => (
                    <SelectItem key={p.paperStockId} value={p.paperStockId}>
                      {p.name}{p.weightGsm ? ` · ${p.weightGsm}g` : ""}{p.finish ? ` · ${p.finish}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="template-pcm">PCM Code Override</Label>
        <Input
          id="template-pcm"
          value={metadata.pcmCode}
          onChange={(e) => {
            setMetadata((c) => ({ ...c, pcmCode: e.target.value }));
            setMetadataSuccess(null);
          }}
          placeholder={(() => {
            const pf = formatOptions.find((f) => f.id === metadata.productFormatId);
            return pf?.pcmCode ? `Inherited: ${pf.pcmCode}` : "No PCM code set";
          })()}
        />
        <p className="text-xs text-slate-500">
          Overrides the PCM code from Product/Format. Leave empty to inherit.
        </p>
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
          <h3 className="text-sm font-semibold text-slate-900">{t("detail.addresses.heading")}</h3>
          <p className="text-xs text-slate-500">{t("detail.addresses.description")}</p>
        </div>
        {template.brandAssignments.length === 0 ? (
          <p className="text-xs text-slate-500">{t("detail.addresses.none")}</p>
        ) : isLoadingAddresses ? (
          <p className="text-xs text-slate-500">{t("detail.addresses.loading")}</p>
        ) : (
          <div className="space-y-4">
            {addressGroups.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
                <span>{t("detail.addresses.empty")}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const loadKey = `${template.id}:${brandAssignmentKey}`;
                      lastAddressLoadAttemptKey.current = "";
                      void loadTemplateAddresses(loadKey, new AbortController().signal, true);
                    }}
                  >
                    {t("detail.addresses.reload")}
                  </Button>
              </div>
            ) : (
              addressGroups.map((group) => (
                <div key={group.brandId} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900">{group.brandName}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSaveAddresses(group.brandId)}
                      disabled={savingAddressesByBrand[group.brandId]}
                    >
                      {savingAddressesByBrand[group.brandId]
                        ? t("detail.addresses.saving")
                        : t("detail.addresses.saveButton")}
                    </Button>
                  </div>
                  {group.addresses.length === 0 ? (
                    <p className="text-xs text-slate-500">{t("detail.addresses.empty")}</p>
                  ) : (
                    <div className="grid gap-2 text-sm text-slate-700">
                      {group.addresses.map((address) => {
                        const label = address.label || address.company || t("detail.addresses.unnamed");
                        const line = [address.street, [address.postalCode, address.city].filter(Boolean).join(" ")]
                          .filter(Boolean)
                          .join(", ");
                        const checked = group.assignedAddressIds.includes(address.id);
                        return (
                          <label key={address.id} className="flex items-start gap-2">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => handleToggleAddress(group.brandId, address.id, value)}
                            />
                            <span>
                              <span className="font-medium text-slate-900">{label}</span>
                              {line ? <span className="block text-xs text-slate-500">{line}</span> : null}
                            </span>
                          </label>
                        );
                      })}
                      <p className="text-xs text-slate-400 mt-1">{t("detail.addresses.hint")}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {addressError ? <p className="text-xs text-red-600">{addressError}</p> : null}
        {addressSuccess ? <p className="text-xs text-emerald-600">{addressSuccess}</p> : null}
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
                      {family.fullFamily ? (
                        <FontPreviewName
                          family={family.fullFamily}
                          enabled
                          className="text-base font-medium text-slate-900"
                        />
                      ) : (
                        <p className="font-medium text-slate-900">{family.name}</p>
                      )}
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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let ignore = false;
    if (!enabled) {
      setLoaded(false);
      return () => {
        ignore = true;
      };
    }

    const promise = loadFontPreviewFace(family);
    if (!promise) {
      setLoaded(false);
      return () => {
        ignore = true;
      };
    }

    promise
      .then(() => {
        if (!ignore) setLoaded(true);
      })
      .catch(() => {
        if (!ignore) setLoaded(false);
      });

    return () => {
      ignore = true;
    };
  }, [family, enabled]);

  const fontFamilyValue =
    loaded && enabled ? `"${family.name}", var(--font-heading, var(--font-sans))` : undefined;

  return (
    <span className={cn("font-semibold text-slate-900", className)} style={fontFamilyValue ? { fontFamily: fontFamilyValue } : undefined}>
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
    return fontPreviewLoaders.get(cacheKey)!;
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
