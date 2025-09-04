// app/omicron/layout.tsx
import type { ReactNode } from "react";
import OmicronShell from "@/components/layout/OmicronShell";
import OmicronNav from "@/components/layout/OmicronNav";
import { Separator } from "@/components/ui/separator";

export default function OmicronRouteLayout({ children }: { children: ReactNode }) {
  const header = (
    <div className="sticky top-0 z-10 -mx-5 mb-2 bg-muted/20 px-5 pb-2 pt-4 md:static md:mx-0 md:px-0 md:pt-0">
      <Separator className="hidden md:block" />
    </div>
  );

  return (
    <OmicronShell sidebar={<OmicronNav />} header={header}>
      {children}
    </OmicronShell>
  );
}
