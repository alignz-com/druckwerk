import { prisma } from "@/lib/prisma"

export function formatReferenceCode(year: number, sequence: number) {
  return `${year}-${sequence.toString().padStart(5, "0")}`
}

export async function reserveReferenceCode() {
  const now = new Date()
  const year = now.getUTCFullYear()
  const counter = await prisma.$transaction((tx) =>
    tx.orderReferenceCounter.upsert({
      where: { year },
      update: { lastValue: { increment: 1 } },
      create: { year, lastValue: 1 },
    })
  )
  return {
    referenceCode: formatReferenceCode(year, counter.lastValue),
    referenceYear: year,
    referenceSequence: counter.lastValue,
  }
}
