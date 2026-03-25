import { NextResponse } from "next/server";
import { del } from "@/lib/blob";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const DAYS_TO_EXPIRE = 7;

function authorize(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[api/cleanup-drafts] missing CRON_SECRET env");
    return new Response("Server misconfigured", { status: 500 });
  }
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

export async function GET(request: Request) {
  const unauthorized = authorize(request);
  if (unauthorized) return unauthorized;
  const cutoff = new Date(Date.now() - DAYS_TO_EXPIRE * 24 * 60 * 60 * 1000);

  const drafts = await prisma.contact.findMany({
    where: {
      status: "DRAFT",
      updatedAt: { lt: cutoff },
    },
    select: { id: true, photoUrl: true },
  });

  const photoUrls = drafts.map((draft) => draft.photoUrl).filter(Boolean) as string[];
  if (photoUrls.length) {
    await Promise.allSettled(photoUrls.map((url) => del(url)));
  }

  await prisma.contact.deleteMany({
    where: {
      id: { in: drafts.map((draft) => draft.id) },
    },
  });

  return NextResponse.json({ deleted: drafts.length });
}
