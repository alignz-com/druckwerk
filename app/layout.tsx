import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionProviderWrapper from "./SessionProviderWrapper"; // 👈 import
import { LocaleProvider } from "@/components/providers/locale-provider";
import { isLocale } from "@/lib/i18n/messages";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
  const locale = isLocale(localeCookie) ? localeCookie : "en";

  return (
    <html lang={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SessionProviderWrapper>
          <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
