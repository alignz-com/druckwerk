"use client";

import { useMemo, useState, useTransition } from "react";
import type { AdminTemplateSummary } from "@/lib/admin/templates-data";

import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DEFAULT_TEMPLATES } from "@/lib/templates-defaults";
import { PaperStockSelector } from "./PaperStockSelector";
import { Checkbox } from "@/components/ui/checkbox";

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
  layoutVersion: string;
  printDpi: string;
  pcmCode: string;
  paperStockId: string;
  config: string;
  hasQrCode: boolean;
};

const emptyForm: FormState = {
  key: "",
  label: "",
  description: "",
  layoutVersion: "",
  printDpi: "",
  pcmCode: "",
  paperStockId: "",
  config: defaultConfig,
  hasQrCode: false,
};

export default function TemplateCreateForm({ onCreated, onCancel, className }: TemplateCreateFormProps) {
  const t = useTranslations("admin.templates");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [previewFrontFile, setPreviewFrontFile] = useState<File | null>(null);
  const [previewBackFile, setPreviewBackFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasUploads = useMemo(() => Boolean(pdfFile || previewFrontFile || previewBackFile), [pdfFile, previewFrontFile, previewBackFile]);

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

    let configObject: unknown;
    try {
      configObject = JSON.parse(form.config);
    } catch {
      setError(t("create.errors.configInvalid"));
      return;
    }

    const description = form.description.trim();

    const payload = new FormData();
    payload.append("key", key);
    payload.append("label", label);
    payload.append("description", description);
    if (layoutVersion !== null) {
      payload.append("layoutVersion", String(layoutVersion));
    }
    if (printDpi !== null) {
      payload.append("printDpi", String(printDpi));
    }
    payload.append("config", JSON.stringify(configObject));
    if (form.pcmCode.trim()) {
      payload.append("pcmCode", form.pcmCode.trim());
    }
    if (form.paperStockId) {
      payload.append("paperStockId", form.paperStockId);
    }
    payload.append("hasQrCode", form.hasQrCode ? "true" : "false");

    if (pdfFile) {
      payload.append("pdfFile", pdfFile);
    }
    if (previewFrontFile) {
      payload.append("previewFrontFile", previewFrontFile);
    }
    if (previewBackFile) {
      payload.append("previewBackFile", previewBackFile);
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/templates", {
          method: "POST",
          body: payload,
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error ?? t("create.errors.requestFailed"));
        }

        if (!data?.template) {
          throw new Error(t("create.errors.requestFailed"));
        }

        onCreated(data.template as AdminTemplateSummary);
        setForm(emptyForm);
        setPdfFile(null);
        setPreviewFrontFile(null);
        setPreviewBackFile(null);
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
        <div className="space-y-2">
          <Label htmlFor="template-pcm-code">{t("create.fields.pcmCode")}</Label>
          <Input
            id="template-pcm-code"
            value={form.pcmCode}
            onChange={(event) => handleChange("pcmCode")(event.target.value)}
            placeholder="pcm_vk_template"
          />
          <p className="text-xs text-slate-500">{t("create.hints.pcmCode")}</p>
        </div>
        <div className="md:col-span-2 rounded-lg border border-slate-200 bg-white/80 p-4">
          <div className="flex items-start gap-4">
            <Checkbox
              id="template-create-has-qr"
              checked={form.hasQrCode}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, hasQrCode: Boolean(checked) }))}
              aria-describedby="template-create-has-qr-hint"
            />
            <div className="space-y-1">
              <Label htmlFor="template-create-has-qr" className="text-sm font-medium text-slate-900">
                {t("create.fields.hasQrCode")}
              </Label>
              <p id="template-create-has-qr-hint" className="text-xs text-slate-500">
                {t("create.hints.hasQrCode")}
              </p>
            </div>
          </div>
        </div>
        <div className="md:col-span-2">
          <PaperStockSelector
            value={form.paperStockId}
            onChange={(next) => handleChange("paperStockId")(next)}
            helperText={t("create.hints.paperStock")}
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

      <div className="space-y-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{t("create.uploads.title")}</h3>
          <p className="text-xs text-slate-500">{t("create.uploads.description")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="template-pdf-file">{t("create.fields.pdfFile")}</Label>
            <Input
              id="template-pdf-file"
              type="file"
              accept="application/pdf"
              onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
            />
            {pdfFile ? <p className="text-xs text-slate-500 truncate">{pdfFile.name}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-preview-front-file">{t("create.fields.previewFrontFile")}</Label>
            <Input
              id="template-preview-front-file"
              type="file"
              accept="image/png,image/svg+xml,image/webp"
              onChange={(event) => setPreviewFrontFile(event.target.files?.[0] ?? null)}
            />
            {previewFrontFile ? <p className="text-xs text-slate-500 truncate">{previewFrontFile.name}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-preview-back-file">{t("create.fields.previewBackFile")}</Label>
            <Input
              id="template-preview-back-file"
              type="file"
              accept="image/png,image/svg+xml,image/webp"
              onChange={(event) => setPreviewBackFile(event.target.files?.[0] ?? null)}
            />
            {previewBackFile ? <p className="text-xs text-slate-500 truncate">{previewBackFile.name}</p> : null}
          </div>
        </div>
        <p className="text-xs text-slate-500">
          {hasUploads ? t("create.uploads.ready") : t("create.uploads.hint")}
        </p>
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
