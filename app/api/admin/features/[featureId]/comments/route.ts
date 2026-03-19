"use server";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { authorizeFeatures } from "@/lib/features-auth";

type Params = { params: Promise<{ featureId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await authorizeFeatures(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { featureId } = await params;

  let payload: { content?: string; author?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = payload.content?.trim();
  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  // Use explicit author from payload, or fall back to auth-derived author
  const author = payload.author?.trim() || auth.author;

  const comment = await prisma.featureComment.create({
    data: { featureId, content, author },
  });

  return NextResponse.json({ comment }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await authorizeFeatures(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { featureId } = await params;

  let payload: { commentId?: string; content?: string; author?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.commentId) {
    return NextResponse.json({ error: "commentId is required" }, { status: 400 });
  }

  const data: Record<string, string> = {};
  if (payload.content?.trim()) data.content = payload.content.trim();
  if (payload.author?.trim()) data.author = payload.author.trim();

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const comment = await prisma.featureComment.update({
    where: { id: payload.commentId, featureId },
    data,
  });

  return NextResponse.json({ comment });
}
