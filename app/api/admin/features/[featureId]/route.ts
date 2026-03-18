"use server";

import { NextRequest, NextResponse } from "next/server";
import { FeatureStatus, FeaturePriority, FeatureCategory } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { authorizeFeatures } from "@/lib/features-auth";

const STATUS_VALUES = Object.values(FeatureStatus);
const PRIORITY_VALUES = Object.values(FeaturePriority);
const CATEGORY_VALUES = Object.values(FeatureCategory);

type Params = { params: Promise<{ featureId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await authorizeFeatures(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { featureId } = await params;

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof payload.title === "string") {
    const title = payload.title.trim();
    if (!title) return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    data.title = title;
  }
  if (payload.description !== undefined) {
    data.description = typeof payload.description === "string" ? payload.description.trim() || null : null;
  }
  if (typeof payload.status === "string" && STATUS_VALUES.includes(payload.status as FeatureStatus)) {
    data.status = payload.status;
    if (payload.status === "DONE") {
      data.completedAt = new Date();
    } else {
      data.completedAt = null;
    }
  }
  if (typeof payload.priority === "string" && PRIORITY_VALUES.includes(payload.priority as FeaturePriority)) {
    data.priority = payload.priority;
  }
  if (typeof payload.category === "string" && CATEGORY_VALUES.includes(payload.category as FeatureCategory)) {
    data.category = payload.category;
  }
  if (typeof payload.sortOrder === "number") {
    data.sortOrder = payload.sortOrder;
  }
  if (payload.imageUrl !== undefined) {
    data.imageUrl = typeof payload.imageUrl === "string" ? payload.imageUrl.trim() || null : null;
  }

  const feature = await prisma.feature.update({
    where: { id: featureId },
    data,
    include: { comments: { orderBy: { createdAt: "desc" } } },
  });

  return NextResponse.json({ feature });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await authorizeFeatures(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { featureId } = await params;

  await prisma.feature.delete({ where: { id: featureId } });

  return NextResponse.json({ ok: true });
}
