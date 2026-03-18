import { getAdminTemplateSummaries } from "@/lib/admin/templates-data";
import { getServerAuthSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import TemplateDetailPage from "@/components/admin/templates/TemplateDetailPage";

type RouteParams = {
  templateId: string;
};

export default async function AdminTemplateDetailPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const session = await getServerAuthSession();

  if (!session || session.user.role !== "ADMIN") {
    redirect("/orders");
  }

  const resolvedParams = await Promise.resolve(params);
  const templateId = resolvedParams?.templateId;

  if (!templateId) {
    notFound();
  }

  const templates = await getAdminTemplateSummaries();
  const template = templates.find((t) => t.id === templateId) ?? null;

  if (!template) {
    notFound();
  }

  return <TemplateDetailPage template={template} />;
}
