"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TemplateAssetType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type TemplateAssetUploaderProps = {
  templateKey: string;
  suggestedVersion: number;
  className?: string;
  onUploaded?: () => void;
};

const assetTypeOptions: { value: string; label: string }[] = [
  { value: "pdf", label: "PDF master" },
  { value: "preview_front", label: "Preview – Front" },
  { value: "preview_back", label: "Preview – Back" },
  { value: "config", label: "Config JSON" },
];

export default function TemplateAssetUploader({
  templateKey,
  suggestedVersion,
  className,
  onUploaded,
}: TemplateAssetUploaderProps) {
  const router = useRouter();
  const [assetType, setAssetType] = useState<string>("pdf");
  const [version, setVersion] = useState<string>(String(suggestedVersion));
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!file) {
      setError("Bitte eine Datei auswählen.");
      return;
    }

    const parsedVersion = Number.parseInt(version, 10);
    if (!Number.isFinite(parsedVersion) || parsedVersion < 1) {
      setError("Version muss eine positive Zahl sein.");
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

      setMessage(`Asset (${humanizeAssetType(uploadedType)}) erfolgreich hochgeladen.`);
      setFile(null);
      startTransition(() => {
        router.refresh();
      });
      onUploaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    }
  };

  return (
    <form onSubmit={onSubmit} className={cn("space-y-4", className)}>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`asset-type-${templateKey}`}>Asset-Typ</Label>
          <Select value={assetType} onValueChange={setAssetType}>
            <SelectTrigger id={`asset-type-${templateKey}`}>
              <SelectValue placeholder="Bitte wählen" />
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
          <Label htmlFor={`asset-version-${templateKey}`}>Version</Label>
          <Input
            id={`asset-version-${templateKey}`}
            type="number"
            min={1}
            step={1}
            value={version}
            onChange={(event) => setVersion(event.target.value)}
          />
          <p className="text-xs text-slate-500">Nächste freie Version: {suggestedVersion}</p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`asset-file-${templateKey}`}>Datei</Label>
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
        {isPending ? "Wird hochgeladen…" : "Asset hochladen"}
      </Button>
    </form>
  );
}

function humanizeAssetType(type: TemplateAssetType | string) {
  switch (type) {
    case TemplateAssetType.PDF:
    case "pdf":
      return "PDF";
    case TemplateAssetType.PREVIEW_FRONT:
    case "preview_front":
      return "Preview Front";
    case TemplateAssetType.PREVIEW_BACK:
    case "preview_back":
      return "Preview Back";
    case TemplateAssetType.CONFIG:
    case "config":
      return "Config";
    default:
      return type;
  }
}
