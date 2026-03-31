"use server";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { authorizeFeatures } from "@/lib/features-auth";

export async function PUT(req: NextRequest) {
  const auth = await authorizeFeatures(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: { order?: { id: string; sortOrder: number }[] };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(payload.order) || payload.order.length === 0) {
    return NextResponse.json(
      { error: "order must be a non-empty array of { id, sortOrder }" },
      { status: 400 },
    );
  }

  for (const item of payload.order) {
    if (typeof item.id !== "string" || typeof item.sortOrder !== "number") {
      return NextResponse.json(
        { error: "Each item must have a string id and numeric sortOrder" },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction(
    payload.order.map((item) =>
      prisma.feature.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
