"use client";

import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
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

export function FontCreateDialog({ open, onOpenChange, onCreated }: Props) {
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
          <DialogDescription>{t("create.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
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
                rows={3}
                placeholder={t("create.placeholders.notes")}
              />
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <LoadingButton type="submit" loading={isSubmitting} loadingText={t("create.submitting")} minWidthClassName="min-w-[140px]">
              {t("create.submit")}
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
