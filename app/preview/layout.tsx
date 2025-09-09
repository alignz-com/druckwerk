// app/preview/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Business Card Preview",
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}