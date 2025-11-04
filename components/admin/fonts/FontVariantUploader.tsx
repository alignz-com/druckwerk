"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AdminFontFamily } from "@/lib/admin/templates-data";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/components/providers/locale-provider";

const FORMAT_OPTIONS = [
  { value: "ttf", label: "TTF" },
  { value: "otf", label: "OTF" },
  { value: "woff", label: "WOFF" },
  { value: "woff2", label: "WOFF2" },
];

type Props = {
  families: Pick<AdminFontFamily, "id" | "name" | "slug">[];
  className?: string;
};

export default function FontVariantUploader({ families, className }: Props) {
  const router = useRouter();
  const t = useTranslations("admin.fonts");
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>(families[0]?.id ?? "new");
  const [familyName, setFamilyName] = useState("");
  const [familySlug, setFamilySlug] = useState("");
  const [weight, setWeight] = useState("400");
  const [style, setStyle] = useState<string>("normal");
  const [format, setFormat] = useState<string>("ttf");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isNewFamily = selectedFamilyId === "new";

  const styleOptions = [
    { value: "normal", label: t("labels.styleNormal") },
    { value: "italic", label: t("labels.styleItalic") },
  ];

  const submit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!file) {
      setError(t("errors.selectFile"));
      return;
    }

    if (isNewFamily && !familyName.trim()) {
      setError(t("errors.nameRequired"));
      return;
    }

    const formData = new FormData();
    if (!isNewFamily) {
      formData.append("familyId", selectedFamilyId);
    } else {
      formData.append("familyName", familyName.trim());
      if (familySlug.trim()) {
        formData.append("familySlug", familySlug.trim());
      }
    }
    formData.append("weight", weight);
    formData.append("style", style);
    formData.append("format", format);
    formData.append("file", file);

    try {
      const response = await fetch("/api/admin/fonts/variants", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? `Upload failed (${response.status})`);
      }

      const payload = await response.json();
      const familyNameResult = payload?.family?.name ?? familyName;
      const variant = payload?.variant;

      const styleLabel = variant?.style === "ITALIC" ? t("labels.styleItalic") : t("labels.styleNormal");
      setMessage(
        variant
          ? t("uploadSuccess", { name: familyNameResult, weight: variant.weight, style: styleLabel })
          : t("uploadSuccessDefault"),
      );
      startTransition(() => {
        router.refresh();
      });
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.uploadFailed"));
    }
  };

  return (
    <form onSubmit={submit} className={cn("space-y-4", className)}>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="font-family">{t("labels.family")}</Label>
          <Select value={selectedFamilyId} onValueChange={setSelectedFamilyId}>
            <SelectTrigger id="font-family">
              <SelectValue placeholder={t("placeholders.family")} />
            </SelectTrigger>
            <SelectContent>
              {families.map((family) => (
                <SelectItem key={family.id} value={family.id}>
                  {family.name}
                </SelectItem>
              ))}
              <SelectItem value="new">{t("labels.newFamily")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isNewFamily ? (
          <div className="grid gap-1.5">
            <Label htmlFor="font-family-name">{t("labels.familyName")}</Label>
            <Input
              id="font-family-name"
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
              placeholder="Frutiger LT Pro"
            />
            <p className="text-xs text-slate-500">{t("hints.familyName")}</p>
          </div>
        ) : null}

        {isNewFamily ? (
          <div className="grid gap-1.5">
            <Label htmlFor="font-family-slug">{t("labels.familySlug")}</Label>
            <Input
              id="font-family-slug"
              value={familySlug}
              onChange={(event) => setFamilySlug(event.target.value)}
              placeholder="frutiger-lt-pro"
            />
          </div>
        ) : null}

        <div className="grid gap-1.5 md:grid-cols-3 md:gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="font-weight">{t("labels.weight")}</Label>
            <Input
              id="font-weight"
              type="number"
              min={100}
              max={900}
              step={100}
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="font-style">{t("labels.style")}</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger id="font-style">
                <SelectValue placeholder={t("placeholders.style")} />
              </SelectTrigger>
              <SelectContent>
                {styleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="font-format">{t("labels.format")}</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger id="font-format">
                <SelectValue placeholder={t("placeholders.format")} />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="font-file">{t("labels.file")}</Label>
          <Input id="font-file" type="file" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
        {isPending ? t("buttons.submitting") : t("buttons.submit")}
      </Button>
    </form>
  );
}
