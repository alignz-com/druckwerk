"use server";

import { NextRequest, NextResponse } from "next/server";
import type { PaperStock } from "@prisma/client";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PaperStockPayload = {
  name?: unknown;
  description?: unknown;
  finish?: unknown;
  color?: unknown;
  weightGsm?: unknown;
};

function mapPaperStock(stock: PaperStock) {
  return {
    id: stock.id,
    name: stock.name,
    description: stock.description ?? null,
    finish: stock.finish ?? null,
    color: stock.color ?? null,
    weightGsm: stock.weightGsm ?? null,
    createdAt: stock.createdAt.toISOString(),
    updatedAt: stock.updatedAt.toISOString(),
  };
}

export async function GET() {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const paperStocks = await prisma.paperStock.findMany({
    orderBy: [{ name: "asc" }],
  });

  return NextResponse.json({
    paperStocks: paperStocks.map((stock) => mapPaperStock(stock)),
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: PaperStockPayload;
  try {
    payload = (await request.json()) as PaperStockPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name must not be empty" }, { status: 400 });
  }

  const description = typeof payload.description === "string" ? payload.description.trim() : undefined;
  const finish = typeof payload.finish === "string" ? payload.finish.trim() : undefined;
  const color = typeof payload.color === "string" ? payload.color.trim() : undefined;
  let weightGsm: number | undefined;
  if (payload.weightGsm !== undefined && payload.weightGsm !== null && String(payload.weightGsm).trim() !== "") {
    const parsed = Number.parseInt(String(payload.weightGsm), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NextResponse.json({ error: "weightGsm must be a positive integer" }, { status: 400 });
    }
    weightGsm = parsed;
  }

  try {
    const stock = await prisma.paperStock.create({
      data: {
        name,
        description,
        finish,
        color,
        weightGsm,
      },
    });

    return NextResponse.json({ paperStock: mapPaperStock(stock) }, { status: 201 });
  } catch (error) {
    console.error("[admin] failed to create paper stock", error);
    return NextResponse.json({ error: "Failed to create paper stock" }, { status: 500 });
  }
}
