"use server";

import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { getAdminUsers } from "@/lib/admin/users-data";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await getAdminUsers();
  return NextResponse.json({ users });
}
