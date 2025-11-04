"use server";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/storage";

const TEMPLATE_BUCKET = process.env.SUPABASE_TEMPLATE_BUCKET ?? "templates";

type RouteParams = { templateId: string };

export async function DELETE(_req: NextRequest, context: { params: RouteParams | Promise<RouteParams> }) {
  const params = await Promise.resolve(context.params);
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { templateId } = params;
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { assets: true },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  try {
    await prisma.template.delete({
      where: { id: templateId },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Template kann nicht gelöscht werden, weil noch Bestellungen oder Zuweisungen darauf verweisen. Bitte entferne diese zuerst.",
        },
        { status: 409 },
      );
    }
    console.error("[admin] delete template failed", error);
    return NextResponse.json({ error: "Template deletion failed" }, { status: 500 });
  }

  // best effort cleanup of storage assets
  const keys = template.assets.map((asset) => asset.storageKey).filter(Boolean);
  await Promise.allSettled(keys.map((key) => deleteObject(TEMPLATE_BUCKET, key).catch(() => undefined)));

  return NextResponse.json({ success: true });
}
