import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/email";

const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

function parseOperatingSystem(secChUaPlatform?: string | null, userAgent?: string | null) {
  const platform = secChUaPlatform?.replace(/"/g, "").trim();
  if (platform) return platform;
  if (!userAgent) return undefined;
  if (userAgent.includes("Windows NT")) return "Windows";
  if (userAgent.includes("Mac OS X")) return "macOS";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS";
  if (userAgent.includes("Linux")) return "Linux";
  return undefined;
}

function parseBrowser(secChUa?: string | null, userAgent?: string | null) {
  if (secChUa) {
    const brands = secChUa
      .split(",")
      .map((entry) => entry.replace(/"/g, "").trim())
      .map((entry) => entry.replace(/;v=\d+/i, "").trim())
      .filter(Boolean);
    const preferredBrand = brands.find((brand) => !/not.*brand/i.test(brand));
    if (preferredBrand) return preferredBrand;
  }
  if (!userAgent) return undefined;
  if (userAgent.includes("Edg/")) return "Microsoft Edge";
  if (userAgent.includes("Chrome/")) return "Chrome";
  if (userAgent.includes("Firefox/")) return "Firefox";
  if (userAgent.includes("Safari/")) return "Safari";
  return undefined;
}

export async function POST(req: NextRequest) {
  let email: string | undefined;
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // avoid user enumeration
    return NextResponse.json({ success: true });
  }

  if (!APP_URL) {
    console.warn("[password-reset] Missing APP_URL env, cannot send reset email");
    return NextResponse.json({ success: true });
  }

  const { token } = await createPasswordResetToken(user.id);
  const resetUrl = new URL(`/password-reset/confirm?token=${token}`, APP_URL).toString();
  const userAgent = req.headers.get("user-agent");
  const secChUa = req.headers.get("sec-ch-ua");
  const secChUaPlatform = req.headers.get("sec-ch-ua-platform");
  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetUrl,
    locale: user.locale,
    operatingSystem: parseOperatingSystem(secChUaPlatform, userAgent),
    browserName: parseBrowser(secChUa, userAgent),
  });

  return NextResponse.json({ success: true });
}
