import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getServerAuthSession } from "@/lib/auth";
import { getTranslations, isLocale } from "@/lib/i18n/messages";
import SignInCard from "./sign-in-card";

type LoginPageProps = {
  searchParams?: Promise<{
    reset?: string;
  }>;
};

export default async function LoginPage({ searchParams: searchParamsPromise }: LoginPageProps) {
  const searchParams = await searchParamsPromise;
  const session = await getServerAuthSession();
  const userLocale = session?.user?.locale;

  if (session) {
    redirect("/orders/new");
  }

  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale")?.value;
  const locale = isLocale(localeCookie)
    ? localeCookie
    : isLocale(userLocale)
      ? userLocale
      : "en";
  const t = getTranslations(locale);

  const successMessage = searchParams?.reset === "success" ? t.login.success : undefined;

  return <SignInCard successMessage={successMessage} />;
}
