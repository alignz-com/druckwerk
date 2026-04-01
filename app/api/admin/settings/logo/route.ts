import { NextRequest, NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { put } from "@/lib/blob";
import { updateSystemSettings } from "@/lib/system-settings";

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
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
    return NextResponse.json({ error: "File must be an image (PNG or JPEG)" }, { status: 400 });
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 2MB)" }, { status: 400 });
  }

  const sanitizedName = file.name.replace(/[^\w.-]+/g, "_") || "logo";
  const path = `logos/${Date.now()}-${sanitizedName}`;

  const upload = await put(path, file, {
    access: "public",
    contentType: file.type,
  });

  await updateSystemSettings({ logoUrl: upload.url });

  return NextResponse.json({ url: upload.url });
}
