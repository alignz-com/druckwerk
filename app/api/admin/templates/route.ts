"use server";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapTemplateToAdminSummary } from "@/lib/admin/templates-data";

const templateInclude = {
  assets: {
    orderBy: [
      { version: "desc" as const },
      { updatedAt: "desc" as const },
    ],
  },
  fonts: {
    include: {
      fontVariant: {
        include: {
          fontFamily: true,
        },
      },
    },
  },
  assignments: {
    include: {
      brand: true,
    },
    orderBy: [{ assignedAt: "desc" as const }],
  },
};

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const key = String(payload?.key ?? "").trim();
  const label = String(payload?.label ?? "").trim();
  const description = payload?.description === null ? null : String(payload?.description ?? "").trim();
  const pdfPath = String(payload?.pdfPath ?? "").trim();
  const previewFrontPath = String(payload?.previewFrontPath ?? "").trim();
  const previewBackPath = String(payload?.previewBackPath ?? "").trim();
  const layoutVersionRaw = payload?.layoutVersion;
  const printDpiRaw = payload?.printDpi;
  const config = payload?.config;

  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }
  if (!/^[a-z0-9._-]+$/i.test(key)) {
    return NextResponse.json({ error: "key must only contain letters, digits, dot, dash, or underscore" }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  if (!pdfPath) {
    return NextResponse.json({ error: "pdfPath is required" }, { status: 400 });
  }
  if (!previewFrontPath) {
    return NextResponse.json({ error: "previewFrontPath is required" }, { status: 400 });
  }
  if (!previewBackPath) {
    return NextResponse.json({ error: "previewBackPath is required" }, { status: 400 });
  }
  if (config === null || typeof config !== "object") {
    return NextResponse.json({ error: "config must be an object" }, { status: 400 });
  }

  let layoutVersion: number | null = null;
  if (layoutVersionRaw !== undefined && layoutVersionRaw !== null && layoutVersionRaw !== "") {
    const parsed = Number.parseInt(String(layoutVersionRaw), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.json({ error: "layoutVersion must be a non-negative integer" }, { status: 400 });
    }
    layoutVersion = parsed;
  }

  let printDpi: number | null = null;
  if (printDpiRaw !== undefined && printDpiRaw !== null && printDpiRaw !== "") {
    const parsed = Number.parseInt(String(printDpiRaw), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.json({ error: "printDpi must be a non-negative integer" }, { status: 400 });
    }
    printDpi = parsed;
  }

  try {
    const template = await prisma.template.create({
      data: {
        key,
        label,
        description: description && description.length > 0 ? description : null,
        pdfPath,
        previewFrontPath,
        previewBackPath,
        layoutVersion,
        printDpi,
        config,
      },
      include: templateInclude,
    });

    return NextResponse.json(
      {
        templateId: template.id,
        template: mapTemplateToAdminSummary(template),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A template with this key already exists" }, { status: 409 });
    }
    console.error("[admin] create template failed", error);
    return NextResponse.json({ error: "Template creation failed" }, { status: 500 });
  }
}
