import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isLocale } from "@/lib/i18n/messages";

export async function PATCH(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const locale = typeof body === "object" && body !== null ? (body as any).locale : undefined;
  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { locale },
  });

  const cookieStore = await cookies();
  cookieStore.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return NextResponse.json({ locale });
}
