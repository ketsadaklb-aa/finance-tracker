import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session || session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true, name: true, role: true, isBlocked: true, createdAt: true },
  });
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { username, name, password } = await request.json();
  if (!username || !name || !password) return NextResponse.json({ error: "All fields required" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return NextResponse.json({ error: "Username already taken" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, name, passwordHash, role: "member" },
    select: { id: true, username: true, name: true, role: true, isBlocked: true, createdAt: true },
  });
  return NextResponse.json(user, { status: 201 });
}
