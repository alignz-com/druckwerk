"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocale, useTranslations } from "@/components/providers/locale-provider";
import { locales, type Locale } from "@/lib/i18n/messages";

export default function LanguageSwitcher() {
  const router = useRouter();
  const { locale, setLocale } = useLocale();
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();

  const handleChange = (next: string) => {
    if (!locales.includes(next as Locale) || next === locale) return;
    const value = next as Locale;
    document.cookie = `locale=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setLocale(value);
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500">{t.language.label}</p>
      <Select value={locale} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">{t.language.en}</SelectItem>
          <SelectItem value="de">{t.language.de}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
