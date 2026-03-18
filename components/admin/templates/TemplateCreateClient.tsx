"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import type { AdminTemplateSummary } from "@/lib/admin/templates-data";
import { useTranslations } from "@/components/providers/locale-provider";
import TemplateCreateForm from "./TemplateCreateForm";

type BrandOption = {
  id: string;
  name: string;
  slug: string;
};

type TemplateNewPageProps = {
  brandOptions: BrandOption[];
};

export default function TemplateNewPage({ brandOptions }: TemplateNewPageProps) {
  const router = useRouter();
  const t = useTranslations("admin.templates");

  const handleCreated = (template: AdminTemplateSummary) => {
    router.push(`/admin/templates/${template.id}`);
    router.refresh();
  };

  const handleCancel = () => {
    router.push("/admin/templates");
  };

  return (
    <div className="space-y-6 pb-24">
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/admin/templates" className="flex items-center gap-1.5 hover:text-slate-600 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("detail.back")}
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-700">{t("create.title")}</span>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("create.title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("create.description")}</p>
      </div>

      <TemplateCreateForm onCreated={handleCreated} onCancel={handleCancel} brandOptions={brandOptions} />
    </div>
  );
}
