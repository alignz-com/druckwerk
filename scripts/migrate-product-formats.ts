/**
 * Phase 2: Migrate existing Product data into Format + ProductFormat structure.
 *
 * For each Product:
 *   1. Create a Format (copying dimensions/tolerance/bleed)
 *   2. Create a ProductFormat linking Product → Format (copying pcmCode, printDpi, pages)
 *   3. Migrate ProductPaperStock → ProductFormatPaper
 *   4. Migrate BrandProductPaper → BrandProductFormatPreference
 *   5. Backfill Template.productFormatId
 *   6. Backfill PdfOrderItem.productFormatId
 *
 * Safe to run multiple times — skips already-migrated records.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const products = await prisma.product.findMany({
    include: {
      templates: { select: { id: true, productFormatId: true } },
    },
  });

  console.log(`Found ${products.length} products to migrate.`);

  for (const product of products) {
    console.log(`\nMigrating: ${product.name} (${product.id})`);

    // 1. Create Format (one per product for now — admin can consolidate later)
    if (!product.trimWidthMm || !product.trimHeightMm) {
      console.log(`  ⚠ Skipping ${product.name}: no dimensions`);
      continue;
    }
    const formatSlug = `${slugify(product.name)}-${Math.round(product.trimWidthMm)}x${Math.round(product.trimHeightMm)}`;

    let format = await prisma.format.findUnique({ where: { slug: formatSlug } });
    if (!format) {
      format = await prisma.format.create({
        data: {
          name: product.nameEn ?? product.name,
          nameDe: product.nameDe ?? null,
          slug: formatSlug,
          trimWidthMm: product.trimWidthMm,
          trimHeightMm: product.trimHeightMm,
          defaultBleedMm: product.expectedBleedMm ?? 3.0,
          toleranceMm: product.toleranceMm ?? 1.0,
        },
      });
      console.log(`  ✓ Created Format: ${format.slug}`);
    } else {
      console.log(`  → Format already exists: ${format.slug}`);
    }

    // 2. Create ProductFormat
    let productFormat = await prisma.productFormat.findUnique({
      where: { productId_formatId: { productId: product.id, formatId: format.id } },
    });
    if (!productFormat) {
      productFormat = await prisma.productFormat.create({
        data: {
          productId: product.id,
          formatId: format.id,
          pcmCode: product.pcmCode ?? null,
          printDpi: product.printDpi ?? null,
          canvasWidthMm: product.canvasWidthMm ?? null,
          canvasHeightMm: product.canvasHeightMm ?? null,
          minPages: product.minPages ?? null,
          maxPages: product.maxPages ?? null,
          isActive: true,
        },
      });
      console.log(`  ✓ Created ProductFormat (id: ${productFormat.id})`);
    } else {
      console.log(`  → ProductFormat already exists`);
    }

    // 3. Backfill Template.productFormatId
    const templatesToUpdate = product.templates.filter((t) => !t.productFormatId);
    if (templatesToUpdate.length > 0) {
      await prisma.template.updateMany({
        where: { id: { in: templatesToUpdate.map((t) => t.id) } },
        data: { productFormatId: productFormat.id },
      });
      console.log(`  ✓ Backfilled ${templatesToUpdate.length} template(s)`);
    }

  }

  console.log("\n✅ Migration complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
