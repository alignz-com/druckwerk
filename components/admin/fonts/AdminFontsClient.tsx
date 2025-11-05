"use client";

import type { AdminFontFamily } from "@/lib/admin/templates-data";

import { useTranslations } from "@/components/providers/locale-provider";
import FontVariantUploader from "./FontVariantUploader";

type Props = {
  fontFamilies: AdminFontFamily[];
};

export default function AdminFontsClient({ fontFamilies }: Props) {
  const t = useTranslations("admin.fonts");

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("description")}</p>
        </div>
      </header>

      <section className="space-y-6">
        <p className="text-sm text-slate-500">{t("libraryDescription")}</p>

        {fontFamilies.length > 0 ? (
          <div className="space-y-4">
            {fontFamilies.map((family) => (
              <div key={family.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{family.name}</h2>
                    <p className="text-xs text-slate-500">Slug: {family.slug}</p>
                  </div>
                </div>
                {family.variants.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    {family.variants.map((variant) => {
                      const styleLabel = variant.style === "ITALIC" ? t("labels.styleItalic") : t("labels.styleNormal");
                      return (
                        <li key={variant.id} className="rounded-full bg-slate-100 px-3 py-1">
                          {variant.weight} / {styleLabel} / {variant.format}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">{t("empty")}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t("empty")}</p>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-inner">
          <h3 className="text-sm font-semibold text-slate-900">{t("uploaderTitle")}</h3>
          <p className="text-xs text-slate-500">{t("uploaderHint")}</p>
          <FontVariantUploader
            families={fontFamilies.map((family) => ({ id: family.id, name: family.name, slug: family.slug }))}
            className="mt-4"
          />
        </div>
      </section>
    </div>
  );
}
