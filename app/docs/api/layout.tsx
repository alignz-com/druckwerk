import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Documentation - Druckwerk",
  description: "REST API documentation for Druckwerk order ingestion",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
