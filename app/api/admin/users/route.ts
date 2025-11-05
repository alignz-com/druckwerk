"use server";

import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminUsers, mapAdminUser } from "@/lib/admin/users-data";

const ROLE_VALUES = Object.values(UserRole);

export async function GET() {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await getAdminUsers();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: { email?: string; name?: string | null; role?: string; brandId?: string | null };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const emailRaw = payload?.email?.toLowerCase?.().trim();
  if (!emailRaw) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const roleRaw = payload?.role?.toUpperCase?.().trim() ?? "USER";
  if (!ROLE_VALUES.includes(roleRaw as UserRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const brandId = payload?.brandId?.trim() ? payload.brandId.trim() : null;
  if (brandId) {
    const brandExists = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brandExists) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }
  }

  const existing = await prisma.user.findUnique({ where: { email: emailRaw } });
  if (existing) {
    return NextResponse.json({ error: "User with this email already exists" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email: emailRaw,
      name: payload?.name?.trim() || null,
      role: roleRaw as UserRole,
      brandId,
    },
    include: {
      brand: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ user: mapAdminUser(user) });
}
