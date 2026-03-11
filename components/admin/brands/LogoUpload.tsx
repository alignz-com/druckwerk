"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/components/providers/locale-provider";

type Props = {
  label: string;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
};

export default function LogoUpload({ label, hint, value, onChange, disabled }: Props) {
  const t = useTranslations("admin.brands");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/uploads/logo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Upload failed");
      }
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      // reset so same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          <>
            <div className="flex h-12 w-24 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt="Logo preview"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || isUploading}
                onClick={() => inputRef.current?.click()}
              >
                {isUploading ? "Uploading…" : "Replace"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700"
                disabled={disabled}
                onClick={() => onChange("")}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || isUploading}
            className="flex h-20 w-full items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-100 disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4" />
            {isUploading ? t("actions.saving") : "Upload logo (PNG, SVG)"}
          </button>
        )}
      </div>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/svg+xml,image/jpeg,image/webp"
        className="sr-only"
        onChange={handleFileChange}
      />
    </div>
  );
}
