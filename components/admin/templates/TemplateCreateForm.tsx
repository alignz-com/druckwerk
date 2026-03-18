"use client";

import { useState, useTransition } from "react";
import type { AdminTemplateSummary } from "@/lib/admin/templates-data";

import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type TemplateCreateFormProps = {
  onCreated: (template: AdminTemplateSummary) => void;
  onCancel: () => void;
  className?: string;
};

type FormState = {
  key: string;
  label: string;
  description: string;
};

const emptyForm: FormState = {
  key: "",
  label: "",
  description: "",
};

export default function TemplateCreateForm({ onCreated, onCancel, className }: TemplateCreateFormProps) {
  const t = useTranslations("admin.templates");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setError(null);

    const key = form.key.trim();
    if (!key) { setError(t("create.errors.keyRequired")); return; }
    if (!/^[a-z0-9._-]+$/i.test(key)) { setError(t("create.errors.keyInvalid")); return; }

    const label = form.label.trim();
    if (!label) { setError(t("create.errors.labelRequired")); return; }

    const payload = new FormData();
    payload.append("key", key);
    payload.append("label", label);
    payload.append("description", form.description.trim());
    payload.append("config", "{}");
    payload.append("hasQrCode", "false");
    payload.append("hasPhotoSlot", "false");

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/templates", { method: "POST", body: payload });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error ?? t("create.errors.requestFailed"));
        if (!data?.template) throw new Error(t("create.errors.requestFailed"));
        onCreated(data.template as AdminTemplateSummary);
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
            onChange={(e) => setForm((c) => ({ ...c, key: e.target.value }))}
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
            onChange={(e) => setForm((c) => ({ ...c, label: e.target.value }))}
            placeholder={t("create.placeholders.label")}
          />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="template-description">{t("create.fields.description")}</Label>
          <Textarea
            id="template-description"
            value={form.description}
            onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
            placeholder={t("create.placeholders.description")}
            rows={3}
          />
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          {t("create.actions.cancel")}
        </Button>
        <Button type="submit" disabled={isPending || !form.key.trim() || !form.label.trim()}>
          {isPending ? t("create.actions.submitting") : t("create.actions.submit")}
        </Button>
      </div>
    </form>
  );
}
