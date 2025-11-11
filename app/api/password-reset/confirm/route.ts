import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { markPasswordResetTokenUsed, verifyPasswordResetToken } from "@/lib/password-reset";

export async function POST(req: NextRequest) {
  let token: string | undefined;
  let password: string | undefined;
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token.trim() : undefined;
    password = typeof body?.password === "string" ? body.password : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const record = await verifyPasswordResetToken(token);
  if (!record) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: record.userId },
    data: { hashedPassword },
  });
  await markPasswordResetTokenUsed(record.id);
  await prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, usedAt: null } });

  return NextResponse.json({ success: true });
}
