import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminBrand } from "@/lib/admin/brands-data";

const payloadSchema = z.object({
  defaultTemplateId: z.string().optional().nullable(),
  orderedTemplateIds: z.array(z.string()).optional(),
});

type RouteParams = { brandId: string };

export async function PATCH(req: NextRequest, context: { params: RouteParams | Promise<RouteParams> }) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = await Promise.resolve(context.params);
  const brandId = params?.brandId;
  if (!brandId) {
    return NextResponse.json({ error: "Missing brandId" }, { status: 400 });
  }

  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  let payload;
  try {
    payload = payloadSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const assignments = await prisma.brandTemplate.findMany({
    where: { brandId },
    select: { id: true, templateId: true },
    orderBy: [{ orderIndex: "asc" }, { assignedAt: "asc" }],
  });

  const templateIds = assignments.map((assignment) => assignment.templateId);
  const assignedSet = new Set(templateIds);

  if (payload.orderedTemplateIds) {
    if (
      payload.orderedTemplateIds.length !== templateIds.length ||
      payload.orderedTemplateIds.some((id) => !assignedSet.has(id))
    ) {
      return NextResponse.json({ error: "Templates mismatch" }, { status: 400 });
    }
  }

  if (payload.defaultTemplateId && !assignedSet.has(payload.defaultTemplateId)) {
    return NextResponse.json({ error: "Default template must be linked to the brand" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const orderedIds = payload.orderedTemplateIds ?? templateIds;
      for (let index = 0; index < orderedIds.length; index += 1) {
        await tx.brandTemplate.updateMany({
          where: { brandId, templateId: orderedIds[index]! },
          data: { orderIndex: index },
        });
      }

      await tx.brand.update({
        where: { id: brandId },
        data: { defaultTemplateId: payload.defaultTemplateId ?? null },
      });
    });
  } catch (error) {
    console.error("[admin] update brand templates failed", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  const updated = await getAdminBrand(brandId);
  if (!updated) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  return NextResponse.json({ brand: updated });
}
