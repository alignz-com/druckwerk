"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import type { AdminTemplateSummary } from "@/lib/admin/templates-data";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslations } from "@/components/providers/locale-provider";
import TemplateCreateForm from "./TemplateCreateForm";

export default function TemplateNewPage() {
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
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-start gap-3">
            <Button type="button" variant="ghost" size="sm" asChild className="-ml-2">
              <Link href="/admin/templates" className="flex items-center gap-2 text-slate-600">
                <ArrowLeft className="h-4 w-4" />
                {t("detail.back")}
              </Link>
            </Button>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-slate-900">{t("create.title")}</h1>
              <p className="text-sm text-slate-500">{t("create.description")}</p>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 py-6">
          <TemplateCreateForm onCreated={handleCreated} onCancel={handleCancel} />
        </div>
      </ScrollArea>
    </div>
  );
}
