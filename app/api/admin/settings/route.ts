import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { getSystemSettings, updateSystemSettings } from "@/lib/system-settings";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await getSystemSettings();
  return NextResponse.json({ settings });
}

export async function PUT(req: Request) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof payload.companyName === "string") {
    const name = payload.companyName.trim();
    if (!name) return NextResponse.json({ error: "Company name cannot be empty" }, { status: 400 });
    data.companyName = name;
  }
  if (payload.logoUrl !== undefined) {
    data.logoUrl = typeof payload.logoUrl === "string" ? payload.logoUrl.trim() || null : null;
  }
  if (payload.street !== undefined) {
    data.street = typeof payload.street === "string" ? payload.street.trim() || null : null;
  }
  if (payload.postalCode !== undefined) {
    data.postalCode = typeof payload.postalCode === "string" ? payload.postalCode.trim() || null : null;
  }
  if (payload.city !== undefined) {
    data.city = typeof payload.city === "string" ? payload.city.trim() || null : null;
  }
  if (payload.countryCode !== undefined) {
    data.countryCode = typeof payload.countryCode === "string" ? payload.countryCode.trim() || null : null;
  }
  if (payload.confirmationFontFamily !== undefined) {
    data.confirmationFontFamily =
      typeof payload.confirmationFontFamily === "string" ? payload.confirmationFontFamily.trim() || null : null;
  }
  if (payload.letterheadUrl !== undefined) {
    data.letterheadUrl = typeof payload.letterheadUrl === "string" ? payload.letterheadUrl.trim() || null : null;
    if (!data.letterheadUrl) {
      data.letterheadStoragePath = null;
    }
  }

  const floatFields = [
    "safeTopMm", "safeBottomMm", "safeLeftMm", "safeRightMm",
    "addressWindowXMm", "addressWindowYMm", "addressWindowWidthMm", "addressWindowHeightMm",
  ] as const;
  for (const field of floatFields) {
    if (payload[field] !== undefined) {
      const val = Number(payload[field]);
      data[field] = isFinite(val) ? val : null;
    }
  }

  const settings = await updateSystemSettings(data);
  return NextResponse.json({ settings });
}
