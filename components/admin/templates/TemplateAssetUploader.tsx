"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/components/providers/locale-provider";

type TemplateAssetUploaderProps = {
  templateKey: string;
  suggestedVersion: number;
  className?: string;
  onUploaded?: () => void;
};

export default function TemplateAssetUploader({
  templateKey,
  suggestedVersion,
  className,
  onUploaded,
}: TemplateAssetUploaderProps) {
  const router = useRouter();
  const t = useTranslations("admin.templates");
  const [assetType, setAssetType] = useState<string>("pdf");
  const [version, setVersion] = useState<string>(String(suggestedVersion));
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const assetTypeOptions: { value: string; label: string }[] = [
    { value: "pdf", label: t("assetTypes.PDF") },
    { value: "preview_front", label: t("assetTypes.PREVIEW_FRONT") },
    { value: "preview_back", label: t("assetTypes.PREVIEW_BACK") },
    { value: "config", label: t("assetTypes.CONFIG") },
  ];

  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!file) {
      setError(t("detail.errors.selectFile"));
      return;
    }

    const parsedVersion = Number.parseInt(version, 10);
    if (!Number.isFinite(parsedVersion) || parsedVersion < 1) {
      setError(t("detail.errors.invalidVersion"));
      return;
    }

    const formData = new FormData();
    formData.append("templateKey", templateKey);
    formData.append("version", String(parsedVersion));
    formData.append("assetType", assetType);
    formData.append("file", file);

    try {
      const response = await fetch("/api/admin/templates/assets", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? `Upload failed (${response.status})`);
      }

      const payload = await response.json();
      const uploadedType = payload?.asset?.type ?? assetType;
      let localizedType: string;
      try {
        localizedType = t(`assetTypes.${String(uploadedType).toUpperCase()}` as any);
      } catch {
        localizedType = String(uploadedType);
      }

      setMessage(t("detail.assetUploaded", { type: localizedType }));
      setFile(null);
      startTransition(() => {
        router.refresh();
      });
      onUploaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("detail.errors.uploadFailed"));
    }
  };

  return (
    <form onSubmit={onSubmit} className={cn("space-y-4", className)}>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`asset-type-${templateKey}`}>{t("detail.upload.typeLabel")}</Label>
          <Select value={assetType} onValueChange={setAssetType}>
            <SelectTrigger id={`asset-type-${templateKey}`}>
              <SelectValue placeholder={t("detail.upload.typeLabel")} />
            </SelectTrigger>
            <SelectContent>
              {assetTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`asset-version-${templateKey}`}>{t("detail.upload.versionLabel")}</Label>
          <Input
            id={`asset-version-${templateKey}`}
            type="number"
            min={1}
            step={1}
            value={version}
            onChange={(event) => setVersion(event.target.value)}
          />
          <p className="text-xs text-slate-500">{t("detail.upload.versionHint", { version: suggestedVersion })}</p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`asset-file-${templateKey}`}>{t("detail.upload.fileLabel")}</Label>
          <Input
            id={`asset-file-${templateKey}`}
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? t("detail.upload.submitting") : t("detail.upload.submit")}
      </Button>
    </form>
  );
}
