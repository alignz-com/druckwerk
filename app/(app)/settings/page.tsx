import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";
import { getTranslations, isLocale } from "@/lib/i18n/messages";
import { cookies } from "next/headers";
import SettingsPageContent from "@/components/settings/SettingsPageContent";

export default async function SettingsPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/login");

  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale")?.value;
  const userLocale = session.user.locale;
  const locale = isLocale(localeCookie) ? localeCookie : isLocale(userLocale) ? userLocale : "en";
  const t = getTranslations(locale);

  const hasPassword = Boolean(session.user.hasPassword);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t.layout.settings.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{t.layout.settings.description}</p>
      </div>
      <SettingsPageContent hasPassword={hasPassword} />
    </div>
  );
}
