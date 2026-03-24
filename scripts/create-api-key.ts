/**
 * Creates an API key for external order ingestion (brand-level).
 *
 * Usage:
 *   npx tsx scripts/create-api-key.ts <brandId> [label]
 *
 * The raw API key is printed once — store it securely.
 */
import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { randomBytes, createHash } from "crypto"

const prisma = new PrismaClient()

async function main() {
  const [brandId, label] = process.argv.slice(2)

  if (!brandId) {
    console.error("Usage: npx tsx scripts/create-api-key.ts <brandId> [label]")
    process.exit(1)
  }

  const brand = await prisma.brand.findUnique({ where: { id: brandId } })
  if (!brand) {
    console.error(`Brand not found: ${brandId}`)
    process.exit(1)
  }

  const raw = randomBytes(32).toString("hex")
  const hashed = createHash("sha256").update(raw).digest("hex")

  const apiKey = await prisma.apiKey.create({
    data: {
      key: hashed,
      label: label || `${brand.name} API`,
      brandId,
    },
  })

  console.log("")
  console.log("API key created successfully.")
  console.log(`  ID:    ${apiKey.id}`)
  console.log(`  Label: ${apiKey.label}`)
  console.log(`  Brand: ${brand.name}`)
  console.log("")
  console.log("Bearer token (store securely — shown only once):")
  console.log(`  ${raw}`)
  console.log("")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
