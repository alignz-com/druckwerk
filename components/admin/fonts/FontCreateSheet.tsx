"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "@/components/providers/locale-provider";
import type { AdminFontFamily } from "@/lib/admin/templates-data";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (family: AdminFontFamily) => void;
};

const STYLE_OPTIONS = [
  { value: "NORMAL", key: "labels.styleNormal" },
  { value: "ITALIC", key: "labels.styleItalic" },
];

const UNSET_STYLE_VALUE = "__unset_style__";

export function FontCreateSheet({ open, onOpenChange, onCreated }: Props) {
  const t = useTranslations("admin.fonts");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [defaultWeight, setDefaultWeight] = useState("");
  const [defaultStyle, setDefaultStyle] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setSlug("");
    setDefaultWeight("");
    setDefaultStyle(null);
    setNotes("");
    setIsSubmitting(false);
    setError(null);
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError(t("errors.nameRequired"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      defaultWeight: defaultWeight.trim() ? Number(defaultWeight.trim()) : null,
      defaultStyle: defaultStyle ?? null,
      notes: notes.trim() ? notes.trim() : null,
    };

    try {
      const response = await fetch("/api/admin/fonts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.family) {
        throw new Error(data?.error ?? t("create.errors.createFailed"));
      }

      onCreated(data.family as AdminFontFamily);
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("create.errors.createFailed"));
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
        }
        onOpenChange(next);
      }}
    >
      <SheetContent className="flex h-full max-w-lg flex-col p-0">
        <SheetHeader className="border-b border-slate-200 px-6 py-5 text-left">
          <SheetTitle>{t("create.title")}</SheetTitle>
          <SheetDescription>{t("create.description")}</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-5 px-6 py-6">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="font-create-name">{t("create.fields.name")}</Label>
              <Input
                id="font-create-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("create.placeholders.name")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="font-create-slug">{t("create.fields.slug")}</Label>
              <Input
                id="font-create-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder={t("create.placeholders.slug")}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="font-create-weight">{t("create.fields.defaultWeight")}</Label>
                <Input
                  id="font-create-weight"
                  type="number"
                  min={100}
                  max={1000}
                  step={50}
                  value={defaultWeight}
                  onChange={(event) => setDefaultWeight(event.target.value)}
                  placeholder="400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-create-style">{t("create.fields.defaultStyle")}</Label>
                <Select
                  value={defaultStyle ?? UNSET_STYLE_VALUE}
                  onValueChange={(value) => setDefaultStyle(value === UNSET_STYLE_VALUE ? null : value)}
                >
                  <SelectTrigger id="font-create-style">
                    <SelectValue placeholder={t("create.placeholders.defaultStyle")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET_STYLE_VALUE}>{t("create.unset")}</SelectItem>
                    {STYLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.key as any)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="font-create-notes">{t("create.fields.notes")}</Label>
              <Textarea
                id="font-create-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                placeholder={t("create.placeholders.notes")}
              />
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t("actions.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[150px]">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {t("create.submitting")}
                </>
              ) : (
                t("create.submit")
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
