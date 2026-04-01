import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CSV_HEADERS = [
  "Order No.",
  "Type",
  "Express",
  "Qty",
  "Product",
  "Format",
  "Brand",
  "Template / File",
  "Name",
  "Role",
  "Email",
  "Ship To",
  "Pages",
  "Customer Ref",
  "Created",
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
              type: true,
              requesterName: true,
              requesterRole: true,
              requesterEmail: true,
              quantity: true,
              deliveryTime: true,
              createdAt: true,
              meta: true,
              brand: { select: { name: true } },
              template: {
                select: {
                  label: true,
                  key: true,
                  product: { select: { name: true } },
                  productFormat: {
                    select: {
                      format: { select: { name: true } },
                    },
                  },
                },
              },
              pdfOrderItems: {
                orderBy: { createdAt: "asc" },
                include: {
                  productFormat: {
                    include: {
                      product: { select: { name: true } },
                      format: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!delivery) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Ship To — same for all rows in a confirmation
  const shipTo = [
    (delivery as any).shippingCompany,
    (delivery as any).shippingStreet,
    (delivery as any).shippingAddressExtra,
    [(delivery as any).shippingPostalCode, (delivery as any).shippingCity].filter(Boolean).join(" "),
    (delivery as any).shippingCountryCode,
  ]
    .filter((v) => v && String(v).trim())
    .join(", ");

  const rows = [toCsvLine(CSV_HEADERS)];

  for (const item of delivery.items) {
    const order = item.order as any;
    const customerRef =
      typeof order.meta === "object" && order.meta && "customerReference" in order.meta
        ? (order.meta as any).customerReference ?? ""
        : "";
    const isExpress = order.deliveryTime === "express";
    const brandName = order.brand?.name ?? "";
    const createdAt = order.createdAt ? new Date(order.createdAt).toISOString().slice(0, 10) : "";
    const email = order.requesterEmail ?? "";

    if (order.type === "UPLOAD" && order.pdfOrderItems?.length > 0) {
      for (const pdfItem of order.pdfOrderItems) {
        rows.push(
          toCsvLine([
            order.referenceCode,
            "Print Job",
            isExpress ? "Yes" : "No",
            pdfItem.quantity,
            pdfItem.productFormat?.product?.name ?? "",
            pdfItem.productFormat?.format?.name ?? "",
            brandName,
            pdfItem.filename,
            order.requesterName,
            order.requesterRole ?? "",
            email,
            shipTo,
            pdfItem.pages ?? "",
            customerRef,
            createdAt,
          ]),
        );
      }
    } else {
      rows.push(
        toCsvLine([
          order.referenceCode,
          "Business Card",
          isExpress ? "Yes" : "No",
          order.quantity,
          order.template?.product?.name ?? "",
          order.template?.productFormat?.format?.name ?? "",
          brandName,
          order.template?.label ?? order.template?.key ?? "",
          order.requesterName,
          order.requesterRole ?? "",
          email,
          shipTo,
          "",
          customerRef,
          createdAt,
        ]),
      );
    }
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
