import { getAdminFontFamilies, getAdminTemplateSummaries } from "@/lib/admin/templates-data";

import AdminTemplatesClient from "./AdminTemplatesClient";

export default async function AdminTemplatesView() {
  const [templates, fontFamilies] = await Promise.all([getAdminTemplateSummaries(), getAdminFontFamilies()]);

  return <AdminTemplatesClient templates={templates} fontFamilies={fontFamilies} />;
}
