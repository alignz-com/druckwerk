import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ quantity: z.number().int().min(1) });

type Params = { orderId: string; itemId: string };

async function resolveParams(context: { params: Promise<Params> }): Promise<Params> {
  return Promise.resolve(context.params);
}

export async function PATCH(req: Request, context: { params: Promise<Params> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "PRINTER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId, itemId } = await resolveParams(context);

  let payload;
  try {
    payload = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const item = await prisma.pdfOrderItem.findFirst({
    where: { id: itemId, orderId },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.pdfOrderItem.update({
    where: { id: itemId },
    data: { quantity: payload.quantity },
    select: { id: true, quantity: true },
  });

  return NextResponse.json({ item: updated });
}
