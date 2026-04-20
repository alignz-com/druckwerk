import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/orders/papers?brandId=...&productFormatId=...
 *
 * Returns paper stocks available for ordering: the intersection of
 * papers assigned to the product format AND the brand's paper whitelist.
 * If the brand has no whitelist (no BrandPaper rows), returns all
 * product format papers.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brandId = req.nextUrl.searchParams.get("brandId");
  const productFormatId = req.nextUrl.searchParams.get("productFormatId");

  if (!brandId || !productFormatId) {
    return NextResponse.json({ error: "brandId and productFormatId are required" }, { status: 400 });
  }

  // 1. Get papers assigned to this product format
  const formatPapers = await prisma.productFormatPaper.findMany({
    where: { productFormatId },
    include: { paperStock: true },
    orderBy: { paperStock: { name: "asc" } },
  });

  if (formatPapers.length === 0) {
    return NextResponse.json([]);
  }

  // 2. Get the brand's paper whitelist
  const brandPapers = await prisma.brandPaper.findMany({
    where: { brandId },
    select: { paperStockId: true },
  });

  // 3. If brand has no whitelist, return all format papers
  let papers = formatPapers;
  if (brandPapers.length > 0) {
    const allowedIds = new Set(brandPapers.map((bp) => bp.paperStockId));
    papers = formatPapers.filter((fp) => allowedIds.has(fp.paperStockId));
  }

  return NextResponse.json(
    papers.map((fp) => ({
      id: fp.id,
      paperStockId: fp.paperStockId,
      role: fp.role,
      isDefault: fp.isDefault,
      pcmCode: fp.pcmCode,
      name: fp.paperStock.name,
      description: fp.paperStock.description,
      finish: fp.paperStock.finish,
      color: fp.paperStock.color,
      weightGsm: fp.paperStock.weightGsm,
    })),
  );
}
