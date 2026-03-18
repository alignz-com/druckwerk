"use server";

import { NextRequest, NextResponse } from "next/server";

import { authorizeFeatures } from "@/lib/features-auth";
import { put } from "@/lib/blob";

export async function POST(req: NextRequest) {
  const auth = await authorizeFeatures(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  // 5MB limit
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const sanitizedName = file.name.replace(/[^\w.-]+/g, "_") || "image";
  const path = `features/${Date.now()}-${sanitizedName}`;

  const upload = await put(path, file, {
    access: "public",
    contentType: file.type,
  });

  return NextResponse.json({ url: upload.url });
}
