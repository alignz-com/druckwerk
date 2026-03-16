"use client"

import Link from "next/link"
import { CreditCard, FileUp } from "lucide-react"
import { useTranslations } from "@/components/providers/locale-provider"

export function OrderTypeSelector() {
  const t = useTranslations("nav")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("orderTypeTitle")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("orderTypeSubtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
        <Link
          href="/orders/new/card"
          className="flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-white p-8 text-center transition-colors hover:border-foreground/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CreditCard className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-semibold">{t("orderTypeBusinessCards")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("orderTypeBusinessCardsDesc")}</p>
          </div>
        </Link>

        <Link
          href="/orders/new/pdf"
          className="flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-white p-8 text-center transition-colors hover:border-foreground/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FileUp className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-semibold">{t("orderTypePdfPrint")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("orderTypePdfPrintDesc")}</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
