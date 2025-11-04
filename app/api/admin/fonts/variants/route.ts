import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { FontFormat, FontStyle } from "@prisma/client";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFontVariant } from "@/lib/storage";

const FONT_STYLE_MAP: Record<string, FontStyle> = {
  normal: FontStyle.NORMAL,
  italic: FontStyle.ITALIC,
};

const FONT_FORMAT_MAP: Record<string, FontFormat> = {
  ttf: FontFormat.TTF,
  otf: FontFormat.OTF,
  woff: FontFormat.WOFF,
  woff2: FontFormat.WOFF2,
};

function parseFontStyle(value: FormDataEntryValue | null): FontStyle {
  if (!value) return FontStyle.NORMAL;
  const key = String(value).toLowerCase();
  return FONT_STYLE_MAP[key] ?? FontStyle.NORMAL;
}

function parseFontFormat(value: FormDataEntryValue | null): FontFormat {
  if (!value) return FontFormat.TTF;
  const key = String(value).toLowerCase();
  return FONT_FORMAT_MAP[key] ?? FontFormat.TTF;
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  let familyId = String(form.get("familyId") ?? "").trim();
  let familySlug = String(form.get("familySlug") ?? "").trim();
  const familyName = String(form.get("familyName") ?? "").trim();

  let family =
    familyId &&
    (await prisma.fontFamily.findUnique({
      where: { id: familyId },
    }));

  if (!family) {
    if (!familySlug && familyName) {
      familySlug = slugify(familyName);
    }
    if (!familySlug) {
      return NextResponse.json({ error: "Provide either familyId or familySlug/familyName" }, { status: 400 });
    }

    family =
      (await prisma.fontFamily.findUnique({
        where: { slug: familySlug },
      })) ??
      (familyName
        ? await prisma.fontFamily.create({
            data: {
              name: familyName,
              slug: familySlug,
            },
          })
        : null);
  }

  if (!family) {
    return NextResponse.json({ error: "Font family not found and could not be created" }, { status: 404 });
  }

  const weight = Number.parseInt(String(form.get("weight") ?? "400"), 10);
  const style = parseFontStyle(form.get("style"));
  const format = parseFontFormat(form.get("format"));

  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const checksum = createHash("sha256").update(data).digest("hex");
  const fileName = file.name || `${family.slug}-${weight}${style === FontStyle.ITALIC ? "i" : ""}.${format.toLowerCase()}`;
  const contentType = file.type || guessFontContentType(format);

  const upload = await uploadFontVariant(
    {
      familySlug: family.slug,
      weight,
      style: style === FontStyle.ITALIC ? "italic" : "normal",
      format: format.toLowerCase() as "ttf" | "otf" | "woff" | "woff2",
      fileName,
      data,
      contentType,
    },
    { upsert: true },
  );

  const variant = await prisma.fontVariant.create({
    data: {
      fontFamilyId: family.id,
      weight,
      style,
      format,
      storageKey: upload.storageKey,
      fileName,
      checksum,
      sizeBytes: upload.sizeBytes ?? data.byteLength,
    },
  });

  return NextResponse.json({
    family,
    variant,
  });
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function guessFontContentType(format: FontFormat) {
  switch (format) {
    case FontFormat.OTF:
      return "font/otf";
    case FontFormat.WOFF:
      return "font/woff";
    case FontFormat.WOFF2:
      return "font/woff2";
    default:
      return "font/ttf";
  }
}
