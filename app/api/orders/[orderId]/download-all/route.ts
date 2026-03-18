import { NextResponse } from "next/server";
import JSZip from "jszip";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { S3_PUBLIC_URL, ORDERS_BUCKET } from "@/lib/s3";

type RouteParams = { orderId: string };

export async function GET(req: Request, context: { params: Promise<RouteParams> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await Promise.resolve(context.params);
  const type = new URL(req.url).searchParams.get("type");

  if (type !== "jdf" && type !== "pdf") {
    return NextResponse.json({ error: "type must be jdf or pdf" }, { status: 400 });
  }

  const role = session.user.role;

  if (type === "jdf" && role !== "ADMIN" && role !== "PRINTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      referenceCode: true,
      userId: true,
      type: true,
      pdfOrderItems: {
        orderBy: { createdAt: "asc" },
        select: {
          filename: true,
          storagePath: true,
          pdfUrl: true,
          jdfJob: {
            select: { jdfUrl: true, jdfFileName: true },
          },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Users can only download their own orders; admin/printer can download any
  if (role !== "ADMIN" && role !== "PRINTER" && order.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (order.type !== "PDF_PRINT" || order.pdfOrderItems.length === 0) {
    return NextResponse.json({ error: "No PDF items on this order" }, { status: 400 });
  }

  const S3_BASE = `${S3_PUBLIC_URL}/${ORDERS_BUCKET}`;
  const zip = new JSZip();

  await Promise.all(
    order.pdfOrderItems.map(async (item) => {
      const fileUrl =
        type === "pdf"
          ? (item.pdfUrl ?? (item.storagePath ? `${S3_BASE}/${item.storagePath}` : null))
          : (item.jdfJob?.jdfUrl ?? null);

      const fileName =
        type === "pdf"
          ? item.filename
          : (item.jdfJob?.jdfFileName ?? item.filename.replace(/\.pdf$/i, ".jdf"));

      if (!fileUrl) return;

      try {
        const res = await fetch(fileUrl);
        if (!res.ok) return;
        zip.file(fileName, await res.arrayBuffer());
      } catch {
        // skip files that can't be fetched
      }
    }),
  );

  const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });
  const refCode = order.referenceCode ?? orderId;
  const zipName = `${refCode}-${type === "jdf" ? "jdf" : "pdf"}-files.zip`;

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
    },
  });
}
