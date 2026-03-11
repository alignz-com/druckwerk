/**
 * Reassigns Order.templateId based on Order.meta.templateKey matching Template.key.
 *
 * Run after importing a production DB dump and creating new templates, to re-link
 * orders to the correct template records.
 *
 * Usage:
 *   DATABASE_URL="..." npx tsx scripts/reassign-order-templates.ts
 *
 * Optional: pass a key mapping if template keys changed:
 *   KEY_MAP='{"old-key":"new-key"}' DATABASE_URL="..." npx tsx scripts/reassign-order-templates.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Optional key remapping, e.g. {"omicron":"standard-v2"}
const KEY_MAP: Record<string, string> = process.env.KEY_MAP
  ? JSON.parse(process.env.KEY_MAP)
  : {};

async function main() {
  const templates = await prisma.template.findMany({ select: { id: true, key: true } });
  const templateByKey = new Map(templates.map((t) => [t.key, t.id]));

  console.log(`Found ${templates.length} templates: ${templates.map((t) => t.key).join(", ")}`);

  const orders = await prisma.order.findMany({
    select: { id: true, referenceCode: true, templateId: true, meta: true },
  });

  console.log(`Processing ${orders.length} orders...`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const order of orders) {
    const meta = typeof order.meta === "object" && order.meta ? (order.meta as Record<string, unknown>) : {};
    let key = typeof meta.templateKey === "string" ? meta.templateKey.trim() : null;

    if (!key) {
      console.warn(`  SKIP ${order.referenceCode}: no templateKey in meta`);
      skipped++;
      continue;
    }

    // Apply key remapping if provided
    if (KEY_MAP[key]) {
      console.log(`  REMAP ${order.referenceCode}: ${key} → ${KEY_MAP[key]}`);
      key = KEY_MAP[key];
    }

    const newTemplateId = templateByKey.get(key);
    if (!newTemplateId) {
      console.warn(`  NOT FOUND ${order.referenceCode}: template key "${key}" has no match`);
      notFound++;
      continue;
    }

    if (order.templateId === newTemplateId) {
      skipped++;
      continue;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { templateId: newTemplateId },
    });
    updated++;
  }

  console.log(`\nDone. Updated: ${updated} | Already correct/skipped: ${skipped} | Not found: ${notFound}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
