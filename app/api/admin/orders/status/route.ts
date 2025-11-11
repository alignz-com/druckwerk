import { NextRequest, NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: { orderIds?: unknown; status?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderIds = Array.isArray(payload.orderIds)
    ? payload.orderIds.map((id) => (typeof id === "string" ? id.trim() : "")).filter((id) => id.length > 0)
    : [];

  if (orderIds.length === 0) {
    return NextResponse.json({ error: "orderIds must be a non-empty array of strings" }, { status: 400 });
  }

  const statusValue = typeof payload.status === "string" ? payload.status : "";
  const status = Object.values(OrderStatus).includes(statusValue as OrderStatus)
    ? (statusValue as OrderStatus)
    : null;

  if (!status) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const result = await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { status },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error("[orders] bulk status update failed", error);
    return NextResponse.json({ error: "Failed to update orders" }, { status: 500 });
  }
}
