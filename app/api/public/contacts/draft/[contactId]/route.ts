import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBrandsForUser } from "@/lib/brand-access";
import { normalizeWebUrl } from "@/lib/normalize-url";

export const runtime = "nodejs";

const updateSchema = z.object({
  brandId: z.string().min(1),
  name: z.string().optional().default(""),
  role: z.string().optional().default(""),
  seniority: z.string().optional().default(""),
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  mobile: z.string().optional().default(""),
  url: z.string().optional().default(""),
  linkedin: z.string().optional().default(""),
  photoUrl: z.string().optional().default(""),
  addressId: z.string().optional().nullable(),
});

function splitName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  const lastName = parts.pop() || "";
  return { firstName: parts.join(" "), lastName };
}

type RouteParams = { contactId: string };

async function resolveParams(context: { params: Promise<RouteParams> }): Promise<RouteParams> {
  const params = await Promise.resolve(context.params);
  if (!params?.contactId) {
    throw new Error("Missing route parameter: contactId");
  }
  return params;
}

export async function PATCH(req: Request, context: { params: Promise<RouteParams> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contactId } = await resolveParams(context);

  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const allowedBrands = await getBrandsForUser({
    userId: session.user.id,
    role: session.user.role ?? "USER",
    knownBrandId: session.user.brandId ?? null,
  });
  if (!allowedBrands.some((brand) => brand.id === data.brandId)) {
    return NextResponse.json({ error: "Brand not allowed" }, { status: 403 });
  }

  const { firstName, lastName } = splitName(data.name);
  const updated = await prisma.contact.updateMany({
    where: { id: contactId, brandId: data.brandId, status: "DRAFT" },
    data: {
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      firstName: firstName || data.name || "",
      lastName: lastName || "",
      title: data.role || null,
      department: data.seniority || null,
      email: data.email || null,
      phone: data.phone || null,
      mobile: data.mobile || null,
      website: normalizeWebUrl(data.url) || null,
      linkedin: normalizeWebUrl(data.linkedin) || null,
      photoUrl: data.photoUrl || null,
      addressId: data.addressId ?? null,
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
