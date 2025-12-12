import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CSV_HEADERS = [
  "Reference Code",
  "Brand",
  "Template",
  "Quantity",
  "Requester Name",
  "Requester Role",
  "Delivery Time",
  "Created At",
];

function toCsvLine(values: Array<string | number | null | undefined>) {
  return values
    .map((value) => {
      const text = value === null || value === undefined ? "" : String(value);
      const escaped = text.replace(/"/g, '""');
      return `"${escaped}"`;
    })
    .join(",");
}

export async function GET(_: Request, context: { params: Promise<{ deliveryId: string }> }) {
  const session = await getServerAuthSession();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "PRINTER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { deliveryId } = await context.params;
  if (!deliveryId) {
    return NextResponse.json({ error: "Invalid delivery id" }, { status: 400 });
  }

  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          order: {
            select: {
              referenceCode: true,
              requesterName: true,
              requesterRole: true,
              quantity: true,
              deliveryTime: true,
              createdAt: true,
              brand: { select: { name: true } },
              template: { select: { label: true, key: true } },
            },
          },
        },
      },
    },
  });

  if (!delivery) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = [toCsvLine(CSV_HEADERS)];
  for (const item of delivery.items) {
    const order = item.order as any;
    rows.push(
      toCsvLine([
        order.referenceCode,
        order.brand?.name ?? "",
        order.template?.label ?? order.template?.key ?? "",
        order.quantity,
        order.requesterName,
        order.requesterRole ?? "",
        order.deliveryTime,
        order.createdAt ? new Date(order.createdAt).toISOString() : "",
      ]),
    );
  }

  const body = rows.join("\r\n");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="confirmation-${delivery.number}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
