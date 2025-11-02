import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

import { generateOrderPdf, type OrderPdfFields } from "@/lib/orderPdf";
import { getTemplateByKey } from "@/lib/templates";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as OrderPdfFields & { template?: string };
    const templateKey = body.template ?? "omicron";
    const templateDefinition = await getTemplateByKey(templateKey);

    const { template: _ignored, ...fields } = body;

    const { pdfBytes, fontReport } = await generateOrderPdf(fields, templateDefinition);

    const urlObj = new URL(req.url);
    if (urlObj.searchParams.has("debug")) {
      const headers: Record<string, string> = {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="preview.pdf"',
      };
      if (fontReport?.length) {
        headers["X-Font-Debug"] = fontReport.join(" | ").slice(0, 1800);
      }
      const debugBlob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
      return new NextResponse(debugBlob, { headers });
    }

    const fileName = `orders/previews/${Date.now()}.pdf`;
    const pdfBlob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
    const { url: blobUrl } = await put(fileName, pdfBlob, {
      access: "public",
      contentType: "application/pdf",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({ fileUrl: blobUrl });
  } catch (err: any) {
    console.error("❌ PDF API Fehler:", err);
    return NextResponse.json({ error: err?.message || "Unbekannter Fehler" }, { status: 500 });
  }
}
