"use server";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminTemplateSummaryInclude, mapTemplateToAdminSummary } from "@/lib/admin/templates-data";

type RouteParams = { templateId: string };

export async function POST(req: NextRequest, context: { params: RouteParams | Promise<RouteParams> }) {
  const params = await Promise.resolve(context.params);
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { templateId } = params;
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  let payload: { brandId?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const brandId = String(payload?.brandId ?? "").trim();
  if (!brandId) {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  }

  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  try {
    await prisma.brandTemplate.create({
      data: {
        brandId,
        templateId,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // already linked, ignore
    } else {
      console.error("[admin] link brand failed", error);
      return NextResponse.json({ error: "Brand link failed" }, { status: 500 });
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

export async function DELETE(req: NextRequest, context: { params: RouteParams | Promise<RouteParams> }) {
  const params = await Promise.resolve(context.params);
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { templateId } = params;
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  let payload: { brandId?: string };
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const brandId = String(payload?.brandId ?? "").trim();
  if (!brandId) {
    return NextResponse.json({ error: "brandId is required" }, { status: 400 });
  }

  await prisma.brandTemplate.deleteMany({
    where: {
      templateId,
      brandId,
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
