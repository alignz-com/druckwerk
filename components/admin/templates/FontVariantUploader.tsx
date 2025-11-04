"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AdminFontFamily } from "@/lib/admin/templates-data";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STYLE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "italic", label: "Kursiv" },
];

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

  const submit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!file) {
      setError("Bitte eine Font-Datei auswählen.");
      return;
    }

    if (isNewFamily && !familyName.trim()) {
      setError("Bitte einen Font-Namen angeben.");
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

      setMessage(
        variant
          ? `Font "${familyNameResult}" (Weight ${variant.weight}, ${variant.style}) erfolgreich hochgeladen.`
          : "Font erfolgreich hochgeladen.",
      );
      startTransition(() => {
        router.refresh();
      });
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    }
  };

  return (
    <form onSubmit={submit} className={cn("space-y-4", className)}>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="font-family">Font Familie</Label>
          <Select value={selectedFamilyId} onValueChange={setSelectedFamilyId}>
            <SelectTrigger id="font-family">
              <SelectValue placeholder="Bitte wählen" />
            </SelectTrigger>
            <SelectContent>
              {families.map((family) => (
                <SelectItem key={family.id} value={family.id}>
                  {family.name}
                </SelectItem>
              ))}
              <SelectItem value="new">Neue Familie anlegen…</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isNewFamily ? (
          <div className="grid gap-1.5">
            <Label htmlFor="font-family-name">Name der Font-Familie</Label>
            <Input
              id="font-family-name"
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
              placeholder="Frutiger LT Pro"
            />
            <p className="text-xs text-slate-500">Der Name erscheint in der Übersicht.</p>
          </div>
        ) : null}

        {isNewFamily ? (
          <div className="grid gap-1.5">
            <Label htmlFor="font-family-slug">Slug (optional)</Label>
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
            <Label htmlFor="font-weight">Weight</Label>
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
            <Label htmlFor="font-style">Stil</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger id="font-style">
                <SelectValue placeholder="Stil wählen" />
              </SelectTrigger>
              <SelectContent>
                {STYLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="font-format">Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger id="font-format">
                <SelectValue placeholder="Format wählen" />
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
          <Label htmlFor="font-file">Font-Datei</Label>
          <Input id="font-file" type="file" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
        {isPending ? "Wird hochgeladen…" : "Font hinzufügen"}
      </Button>
    </form>
  );
}
