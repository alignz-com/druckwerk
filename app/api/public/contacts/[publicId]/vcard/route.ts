import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getPublicContact } from "@/lib/public-contact";
import { buildVCard3 } from "@/lib/vcard";
import { getCountryLabel } from "@/lib/countries";

type RouteParams = { publicId: string };

export const runtime = "nodejs";

async function resolveParams(context: { params: RouteParams | Promise<RouteParams> }): Promise<RouteParams> {
  const params = await Promise.resolve(context.params);
  if (!params?.publicId) {
    throw new Error("Missing route parameter: publicId");
  }
  return params;
}

export async function GET(_req: Request, context: { params: RouteParams | Promise<RouteParams> }) {
  const { publicId } = await resolveParams(context);
  const host = (await headers()).get("host");
  const contact = await getPublicContact(publicId, host);
  if (!contact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  let photo: { data: string; type?: string } | undefined;
  if (contact.photoUrl) {
    try {
      const response = await fetch(contact.photoUrl);
      if (response.ok) {
        const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > 0) {
          const type = (() => {
            if (contentType === "image/png") return "PNG";
            if (contentType === "image/webp") return "WEBP";
            return "JPEG";
          })();
          photo = { data: buffer.toString("base64"), type };
        }
      }
    } catch {
      photo = undefined;
    }
  }
  const countryName = contact.address?.countryCode
    ? getCountryLabel("en", contact.address.countryCode)
    : undefined;
  const vcard = buildVCard3({
    fullName,
    org: contact.address?.company ?? contact.brand.name,
    title: contact.title ?? undefined,
    seniority: contact.department ?? undefined,
    email: contact.email ?? undefined,
    phone: contact.phone ?? undefined,
    mobile: contact.mobile ?? undefined,
    url: contact.website ?? undefined,
    linkedin: contact.linkedin ?? undefined,
    photo,
    addrLabel: contact.address?.company ?? undefined,
    address: contact.address
      ? {
          street: contact.address.street ?? undefined,
          addressExtra: contact.address.addressExtra ?? undefined,
          postalCode: contact.address.postalCode ?? undefined,
          city: contact.address.city ?? undefined,
          country: countryName ?? undefined,
        }
      : undefined,
  });

  const fileSafeName = fullName.replace(/[^\w\s-]+/g, "").trim().replace(/\s+/g, "-") || "contact";
  return new NextResponse(vcard, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileSafeName}.vcf"`,
      "Cache-Control": "no-store",
    },
  });
}
