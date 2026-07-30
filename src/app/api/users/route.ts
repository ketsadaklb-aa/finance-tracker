import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET — minimal user directory for assigning tasks (any signed-in user).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { isBlocked: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}
