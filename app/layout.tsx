import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import SessionProviderWrapper from "./SessionProviderWrapper"; // 👈 import
import { LocaleProvider } from "@/components/providers/locale-provider";
import { isLocale } from "@/lib/i18n/messages";
import { getServerAuthSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Omicron – Business Card Order",
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
  const locale = isLocale(localeCookie)
    ? localeCookie
    : isLocale(userLocale)
      ? userLocale
      : "en";

  return (
    <html lang={locale}>
      <body className="antialiased">
        <SessionProviderWrapper>
          <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
