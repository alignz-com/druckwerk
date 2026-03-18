import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import "./globals.css";
import SessionProviderWrapper from "./SessionProviderWrapper"; // 👈 import
import { LocaleProvider } from "@/components/providers/locale-provider";
import { isLocale } from "@/lib/i18n/messages";
import { getServerAuthSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { fontMono, fontSans } from "@/lib/fonts";
import { QueryProvider } from "@/components/providers/query-provider"
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Druckwerk - Druckerei Thurnher",
  description: "Order and preview business cards online",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale")?.value;
  const session = await getServerAuthSession();
  const userLocale = session?.user?.locale;
  const headersList = await headers();
  const acceptLanguageHeader = headersList.get("accept-language") ?? "";
  const inferredLocale = acceptLanguageHeader
    .split(",")[0]
    ?.trim()
    .toLowerCase()
    .startsWith("de")
    ? "de"
    : "en";
  const locale = isLocale(localeCookie)
    ? localeCookie
    : isLocale(userLocale)
      ? userLocale
      : inferredLocale;

  return (
    <html lang={locale}>
      <body className={cn("antialiased font-sans", fontSans.variable, fontMono.variable)}>
        <SessionProviderWrapper>
          <LocaleProvider initialLocale={locale}>
            <QueryProvider>{children}</QueryProvider>
          </LocaleProvider>
        </SessionProviderWrapper>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
