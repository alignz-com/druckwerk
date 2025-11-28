import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { brandId: string } }) {
  const session = await getServerAuthSession();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "PRINTER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const brandId = params.brandId;
  if (!brandId) {
    return NextResponse.json({ error: "Invalid brand id" }, { status: 400 });
  }

  const addresses = await prisma.brandAddress.findMany({
    where: { brandId },
    orderBy: [{ label: "asc" }, { company: "asc" }],
  });

  return NextResponse.json({
    addresses: addresses.map((addr) => ({
      id: addr.id,
      label: addr.label ?? addr.company ?? "Address",
      company: addr.company,
      street: addr.street,
      postalCode: addr.postalCode,
      city: addr.city,
      countryCode: addr.countryCode,
      addressExtra: addr.addressExtra,
    })),
  });
}
