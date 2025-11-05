"use client";

import { useState, useTransition } from "react";
import type { AdminTemplateSummary } from "@/lib/admin/templates-data";

import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DEFAULT_TEMPLATES } from "@/lib/templates-defaults";

const defaultConfig = JSON.stringify(Object.values(DEFAULT_TEMPLATES)[0]?.config ?? {}, null, 2);

type TemplateCreateFormProps = {
  onCreated: (template: AdminTemplateSummary) => void;
  onCancel: () => void;
  className?: string;
};

type FormState = {
  key: string;
  label: string;
  description: string;
  pdfPath: string;
  previewFrontPath: string;
  previewBackPath: string;
  layoutVersion: string;
  printDpi: string;
  config: string;
};

const emptyForm: FormState = {
  key: "",
  label: "",
  description: "",
  pdfPath: "",
  previewFrontPath: "",
  previewBackPath: "",
  layoutVersion: "",
  printDpi: "",
  config: defaultConfig,
};

export default function TemplateCreateForm({ onCreated, onCancel, className }: TemplateCreateFormProps) {
  const t = useTranslations("admin.templates");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleChange = (field: keyof FormState) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setError(null);

    const key = form.key.trim();
    if (!key) {
      setError(t("create.errors.keyRequired"));
      return;
    }
    if (!/^[a-z0-9._-]+$/i.test(key)) {
      setError(t("create.errors.keyInvalid"));
      return;
    }

    const label = form.label.trim();
    if (!label) {
      setError(t("create.errors.labelRequired"));
      return;
    }

    const pdfPath = form.pdfPath.trim();
    if (!pdfPath) {
      setError(t("create.errors.pdfPathRequired"));
      return;
    }

    const previewFrontPath = form.previewFrontPath.trim();
    if (!previewFrontPath) {
      setError(t("create.errors.previewFrontPathRequired"));
      return;
    }

    const previewBackPath = form.previewBackPath.trim();
    if (!previewBackPath) {
      setError(t("create.errors.previewBackPathRequired"));
      return;
    }

    let layoutVersion: number | null = null;
    if (form.layoutVersion.trim()) {
      const parsed = Number.parseInt(form.layoutVersion.trim(), 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError(t("create.errors.layoutVersionInvalid"));
        return;
      }
      layoutVersion = parsed;
    }

    let printDpi: number | null = null;
    if (form.printDpi.trim()) {
      const parsed = Number.parseInt(form.printDpi.trim(), 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError(t("create.errors.printDpiInvalid"));
        return;
      }
      printDpi = parsed;
    }

    let config: unknown;
    try {
      config = JSON.parse(form.config);
    } catch {
      setError(t("create.errors.configInvalid"));
      return;
    }

    const description = form.description.trim();

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            label,
            description: description || null,
            pdfPath,
            previewFrontPath,
            previewBackPath,
            layoutVersion,
            printDpi,
            config,
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error ?? t("create.errors.requestFailed"));
        }

        if (!payload?.template) {
          throw new Error(t("create.errors.requestFailed"));
        }

        onCreated(payload.template as AdminTemplateSummary);
        setForm(emptyForm);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("create.errors.requestFailed"));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-6", className)}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="template-key">{t("create.fields.key")}</Label>
          <Input
            id="template-key"
            value={form.key}
            onChange={(event) => handleChange("key")(event.target.value)}
            placeholder="example-template"
            autoFocus
          />
          <p className="text-xs text-slate-500">{t("create.hints.key")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="template-label">{t("create.fields.label")}</Label>
          <Input
            id="template-label"
            value={form.label}
            onChange={(event) => handleChange("label")(event.target.value)}
            placeholder={t("create.placeholders.label")}
          />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="template-description">{t("create.fields.description")}</Label>
          <Textarea
            id="template-description"
            value={form.description}
            onChange={(event) => handleChange("description")(event.target.value)}
            placeholder={t("create.placeholders.description")}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="template-pdf">{t("create.fields.pdfPath")}</Label>
          <Input
            id="template-pdf"
            value={form.pdfPath}
            onChange={(event) => handleChange("pdfPath")(event.target.value)}
            placeholder="templates/my-template.pdf"
          />
          <p className="text-xs text-slate-500">{t("create.hints.pdfPath")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="template-preview-front">{t("create.fields.previewFrontPath")}</Label>
          <Input
            id="template-preview-front"
            value={form.previewFrontPath}
            onChange={(event) => handleChange("previewFrontPath")(event.target.value)}
            placeholder="/templates/my-template-front.png"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="template-preview-back">{t("create.fields.previewBackPath")}</Label>
          <Input
            id="template-preview-back"
            value={form.previewBackPath}
            onChange={(event) => handleChange("previewBackPath")(event.target.value)}
            placeholder="/templates/my-template-back.png"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="template-layout-version">{t("create.fields.layoutVersion")}</Label>
          <Input
            id="template-layout-version"
            type="number"
            min={0}
            value={form.layoutVersion}
            onChange={(event) => handleChange("layoutVersion")(event.target.value)}
            placeholder="1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="template-print-dpi">{t("create.fields.printDpi")}</Label>
          <Input
            id="template-print-dpi"
            type="number"
            min={0}
            value={form.printDpi}
            onChange={(event) => handleChange("printDpi")(event.target.value)}
            placeholder="300"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="template-config">{t("create.fields.config")}</Label>
        <Textarea
          id="template-config"
          value={form.config}
          onChange={(event) => handleChange("config")(event.target.value)}
          rows={10}
          className="font-mono text-xs"
        />
        <p className="text-xs text-slate-500">{t("create.hints.config")}</p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          {t("create.actions.cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? t("create.actions.submitting") : t("create.actions.submit")}
        </Button>
      </div>
    </form>
  );
}
