"use server";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminTemplateSummaryInclude, mapTemplateToAdminSummary } from "@/lib/admin/templates-data";

type RouteParams = { templateId: string };

export async function POST(req: NextRequest, context: { params: Promise<RouteParams> }) {
  const params = await Promise.resolve(context.params);
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { templateId } = params;
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  let payload: { fontVariantId?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fontVariantId = String(payload?.fontVariantId ?? "").trim();
  if (!fontVariantId) {
    return NextResponse.json({ error: "fontVariantId is required" }, { status: 400 });
  }

  const variant = await prisma.fontVariant.findUnique({ where: { id: fontVariantId } });
  if (!variant) {
    return NextResponse.json({ error: "Font variant not found" }, { status: 404 });
  }

  try {
    await prisma.templateFont.create({
      data: {
        templateId,
        fontVariantId,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // already linked
    } else {
      console.error("[admin] link font failed", error);
      return NextResponse.json({ error: "Font link failed" }, { status: 500 });
    }
  }

  const updated = await prisma.template.findUnique({
    where: { id: templateId },
    include: adminTemplateSummaryInclude,
  });

  if (!updated) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ template: mapTemplateToAdminSummary(updated) });
}

export async function DELETE(req: NextRequest, context: { params: Promise<RouteParams> }) {
  const params = await Promise.resolve(context.params);
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { templateId } = params;
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  let payload: { fontVariantId?: string };
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const fontVariantId = String(payload?.fontVariantId ?? "").trim();
  if (!fontVariantId) {
    return NextResponse.json({ error: "fontVariantId is required" }, { status: 400 });
  }

  await prisma.templateFont.deleteMany({
    where: {
      templateId,
      fontVariantId,
    },
  });

  const updated = await prisma.template.findUnique({
    where: { id: templateId },
    include: adminTemplateSummaryInclude,
  });

  if (!updated) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ template: mapTemplateToAdminSummary(updated) });
}
