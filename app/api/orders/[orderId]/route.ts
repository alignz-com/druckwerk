import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAllowedQuantities } from "@/lib/order-quantities";

const updateSchema = z
  .object({
    quantity: z.number().int().positive().optional(),
    deliveryDueAt: z.string().datetime().nullable().optional(),
  })
  .refine((d) => d.quantity !== undefined || d.deliveryDueAt !== undefined, {
    message: "Provide quantity or deliveryDueAt",
  });

type RouteParams = { orderId: string };

async function resolveParams(context: { params: RouteParams | Promise<RouteParams> }): Promise<RouteParams> {
  const params = await Promise.resolve(context.params);
  if (!params?.orderId) {
    throw new Error("Missing route parameter: orderId");
  }
  return params;
}

export async function PATCH(req: Request, context: { params: RouteParams | Promise<RouteParams> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "PRINTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await resolveParams(context);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      quantity: true,
      brand: {
        select: {
          quantityMin: true,
          quantityMax: true,
          quantityStep: true,
          quantityOptions: true,
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let payload;
  try {
    payload = updateSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if (payload.quantity !== undefined) {
    const allowed = resolveAllowedQuantities(order.brand ?? undefined);
    if (!allowed.includes(payload.quantity)) {
      return NextResponse.json({ error: "Invalid quantity selection" }, { status: 400 });
    }
    updateData.quantity = payload.quantity;
  }

  if (payload.deliveryDueAt !== undefined) {
    updateData.deliveryDueAt = payload.deliveryDueAt ? new Date(payload.deliveryDueAt) : null;
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: updateData,
    select: { id: true, quantity: true, deliveryDueAt: true },
  });

  return NextResponse.json({ order: updated });
}

export async function DELETE(_req: Request, context: { params: RouteParams | Promise<RouteParams> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "PRINTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await resolveParams(context);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (order.status !== "CANCELLED") {
    return NextResponse.json({ error: "Only cancelled orders can be deleted" }, { status: 400 });
  }

  await prisma.order.delete({ where: { id: orderId } });

  return NextResponse.json({ success: true });
}
