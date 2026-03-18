import { NextResponse } from "next/server";
import { put } from "@/lib/blob";

import { generateOrderPdf, type OrderPdfFields } from "@/lib/orderPdf";
import { getTemplateByKey } from "@/lib/templates";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as OrderPdfFields & { template?: string; qrPayload?: string };
    const templateKey = body.template;
    if (!templateKey) {
      return NextResponse.json({ error: "template is required" }, { status: 400 });
    }
    const templateDefinition = await getTemplateByKey(templateKey);
    if (!templateDefinition) {
      return NextResponse.json({ error: "Template is missing PDF asset" }, { status: 422 });
    }

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
    });

    return NextResponse.json({ fileUrl: blobUrl });
  } catch (err: any) {
    console.error("❌ PDF API Fehler:", err);
    return NextResponse.json({ error: err?.message || "Unbekannter Fehler" }, { status: 500 });
  }
}
