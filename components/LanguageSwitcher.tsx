"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocale, useTranslations } from "@/components/providers/locale-provider";
import { locales, type Locale } from "@/lib/i18n/messages";

type Props = {
  onChanged?: () => void;
};

export default function LanguageSwitcher({ onChanged }: Props) {
  const router = useRouter();
  const { data: session, update } = useSession();
  const { locale, setLocale } = useLocale();
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (next: string) => {
    if (!locales.includes(next as Locale) || next === locale) return;
    const value = next as Locale;
    setError(null);
    setIsSaving(true);
    document.cookie = `locale=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setLocale(value);
    const isAuthenticated = Boolean(session?.user?.id);
    try {
      if (isAuthenticated) {
        const res = await fetch("/api/user/locale", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: value }),
        });
        if (!res.ok) {
          throw new Error(t("language.saveError"));
        }
        await update?.({ locale: value });
      }
      startTransition(() => {
        router.refresh();
      });
      onChanged?.();
    } catch (err: any) {
      if (isAuthenticated) {
        setError(err?.message ?? t("language.saveError"));
      } else {
        console.error(err);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500">{t("language.label")}</p>
      <Select value={locale} onValueChange={handleChange} disabled={isPending || isSaving}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">{t("language.en")}</SelectItem>
          <SelectItem value="de">{t("language.de")}</SelectItem>
        </SelectContent>
      </Select>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
