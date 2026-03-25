import { NextResponse } from "next/server";
import { put } from "@/lib/blob";

import { getServerAuthSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: "file must be an image" }, { status: 400 });
  }

  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large. Max 10 MB." }, { status: 413 });
  }

  const sanitizedName = file.name.replace(/[^\w.-]+/g, "_") || "photo";
  const path = `photos/${Date.now()}-${sanitizedName}`;

  const upload = await put(path, file, {
    access: "public",
    contentType: file.type,
  });

  return NextResponse.json({ url: upload.url, path: upload.pathname ?? path });
}
