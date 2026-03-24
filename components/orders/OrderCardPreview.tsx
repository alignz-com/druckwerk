"use client";

import { useState } from "react";
import type { ResolvedTemplate } from "@/lib/templates";
import { BusinessCardFront, BusinessCardBack } from "@/components/PreviewCard";
import FlipCard from "@/components/FlipCard";

type Props = {
  template: ResolvedTemplate;
  name: string;
  role?: string;
  seniority?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company?: string;
  url?: string;
  linkedin?: string;
  qrPreviewMode?: "vcard" | "public";
  qrPayload?: string | null;
  addressFields?: {
    companyName?: string;
    street?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  };
  frontLabel?: string;
  backLabel?: string;
};

export function OrderCardPreview({
  template,
  name,
  role = "",
  seniority = "",
  email = "",
  phone = "",
  mobile = "",
  company = "",
  url = "",
  linkedin,
  qrPreviewMode = "vcard",
  qrPayload,
  addressFields,
  frontLabel = "Front",
  backLabel = "Back",
}: Props) {
  const [side, setSide] = useState<"front" | "back">("front");

  const trimW = template.pageWidthMm ?? 55;
  const trimH = template.pageHeightMm ?? 85;
  const ratio = trimW / trimH;

  const cardProps = {
    template,
    name,
    role,
    seniority,
    email,
    phone,
    mobile,
    company,
    url,
    linkedin,
    qrPreviewMode,
    qrPayload,
    addressFields,
  };

  return (
    <section className="rounded-2xl border bg-slate-100 p-6">
      <div className="flex gap-1 justify-end mb-4">
        <button
          type="button"
          onClick={() => setSide("front")}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer ${
            side === "front"
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-500 hover:bg-slate-200"
          }`}
        >
          {frontLabel}
        </button>
        <button
          type="button"
          onClick={() => setSide("back")}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer ${
            side === "back"
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-500 hover:bg-slate-200"
          }`}
        >
          {backLabel}
        </button>
      </div>
      <div className="flex items-center justify-center aspect-[3/2]">
        <div
          className="relative overflow-visible"
          style={{
            aspectRatio: `${trimW} / ${trimH}`,
            height: "75%",
          }}
        >
          <FlipCard
            activeSide={side}
            className="h-full w-full"
            front={<BusinessCardFront {...cardProps} />}
            back={<BusinessCardBack {...cardProps} />}
          />
        </div>
      </div>
    </section>
  );
}
