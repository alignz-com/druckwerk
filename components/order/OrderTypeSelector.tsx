"use client"

import Link from "next/link"
import { CreditCard, FileUp } from "lucide-react"

export function OrderTypeSelector() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Order</h1>
        <p className="text-sm text-muted-foreground mt-1">Choose an order type to continue.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
        <Link
          href="/orders/new/card"
          className="flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-white p-8 text-center transition-colors hover:border-foreground/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CreditCard className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-semibold">Business Cards</p>
            <p className="text-xs text-muted-foreground mt-1">Design and order personalised business cards</p>
          </div>
        </Link>

        <Link
          href="/orders/new/pdf"
          className="flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-white p-8 text-center transition-colors hover:border-foreground/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FileUp className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-semibold">PDF Print</p>
            <p className="text-xs text-muted-foreground mt-1">Upload print-ready PDFs for any format</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
