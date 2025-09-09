// app/preview/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Omicron - Business Card - Order",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}