import { getAdminTemplateSummaries } from "@/lib/admin/templates-data";

import AdminTemplatesClient from "./AdminTemplatesClient";

export default async function AdminTemplatesView() {
  const templates = await getAdminTemplateSummaries();

  return <AdminTemplatesClient templates={templates} />;
}
