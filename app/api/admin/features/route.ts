"use server";

import { NextRequest, NextResponse } from "next/server";
import { FeatureStatus, FeaturePriority, FeatureCategory } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { authorizeFeatures } from "@/lib/features-auth";

export async function GET(req: NextRequest) {
  const auth = await authorizeFeatures(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const features = await prisma.feature.findMany({
    include: { comments: { orderBy: { createdAt: "desc" } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ features });
}

const STATUS_VALUES = Object.values(FeatureStatus);
const PRIORITY_VALUES = Object.values(FeaturePriority);
const CATEGORY_VALUES = Object.values(FeatureCategory);

export async function POST(req: NextRequest) {
  const auth = await authorizeFeatures(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: {
    title?: string;
    description?: string | null;
    imageUrls?: string[];
    section?: string | null;
    status?: string;
    priority?: string;
    category?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = payload.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const status = payload.status && STATUS_VALUES.includes(payload.status as FeatureStatus)
    ? (payload.status as FeatureStatus)
    : "IDEA";
  const priority = payload.priority && PRIORITY_VALUES.includes(payload.priority as FeaturePriority)
    ? (payload.priority as FeaturePriority)
    : "MEDIUM";
  const category = payload.category && CATEGORY_VALUES.includes(payload.category as FeatureCategory)
    ? (payload.category as FeatureCategory)
    : "UX";

  const feature = await prisma.feature.create({
    data: {
      title,
      description: payload.description?.trim() || null,
      imageUrls: Array.isArray(payload.imageUrls) ? payload.imageUrls.filter(Boolean) : [],
      section: payload.section?.trim() || null,
      status,
      priority,
      category,
    },
    include: { comments: true },
  });

  return NextResponse.json({ feature }, { status: 201 });
}
