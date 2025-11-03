"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from "@/components/providers/locale-provider";
import { locales, type Locale } from "@/lib/i18n/messages";

export default function LanguageSwitcher() {
  const router = useRouter();
  const { update } = useSession();
  const { locale, setLocale } = useLocale();
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = locale === "de" ? t.language.de : t.language.en;

  const handleChange = async (next: string) => {
    if (!locales.includes(next as Locale) || next === locale) {
      setIsOpen(false);
      return;
    }
    const value = next as Locale;
    setError(null);
    setIsSaving(true);
    document.cookie = `locale=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setLocale(value);
    try {
      const res = await fetch("/api/user/locale", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: value }),
      });
      if (!res.ok) {
        throw new Error("Failed to persist language");
      }
      await update?.({ locale: value });
      startTransition(() => {
        router.refresh();
      });
      setIsOpen(false);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save language preference");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        className="w-full justify-between border border-slate-200 bg-slate-50 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>{t.language.label}</span>
        <span className="text-xs font-normal text-slate-500">{label}</span>
      </Button>
      {isOpen ? (
        <Select
          value={locale}
          onValueChange={handleChange}
          disabled={isPending || isSaving}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">{t.language.en}</SelectItem>
            <SelectItem value="de">{t.language.de}</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
