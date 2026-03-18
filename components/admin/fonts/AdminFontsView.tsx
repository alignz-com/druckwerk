import { getAdminFontFamilies } from "@/lib/admin/templates-data";

import AdminFontsClient from "./AdminFontsClient";

export default async function AdminFontsView({ autoOpen }: { autoOpen?: boolean } = {}) {
  const fontFamilies = await getAdminFontFamilies();

  return <AdminFontsClient fontFamilies={fontFamilies} autoOpen={autoOpen} />;
}
