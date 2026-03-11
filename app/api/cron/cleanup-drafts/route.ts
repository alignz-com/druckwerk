import { NextResponse } from "next/server";
import { del } from "@/lib/blob";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const DAYS_TO_EXPIRE = 7;

export async function GET() {
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
