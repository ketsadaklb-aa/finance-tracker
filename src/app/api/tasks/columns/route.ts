import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const DEFAULT = [
  { id: "todo", label: "To do / Braindump", row: 1 },
  { id: "doing", label: "In progress", row: 1 },
  { id: "delegate", label: "Delegate", row: 2 },
  { id: "later", label: "Later", row: 2 },
  { id: "done", label: "Done", row: 1 },
];

// GET — the user's custom kanban columns (or the default set).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { boardColumns: true } });
  const cols = Array.isArray(user?.boardColumns) ? user!.boardColumns : DEFAULT;
  return NextResponse.json(cols);
}

// PUT — save the column list. Always keeps a "done" column for completion behaviour.
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  if (!Array.isArray(b.columns) || b.columns.length === 0)
    return NextResponse.json({ error: "Provide at least one column" }, { status: 400 });

  const clean = b.columns
    .filter((c: unknown) => c && typeof (c as { id?: unknown }).id === "string" && typeof (c as { label?: unknown }).label === "string")
    .map((c: { id: string; label: string; row?: number }) => ({
      id: c.id, label: c.label.trim() || "Untitled", row: typeof c.row === "number" && c.row >= 1 ? Math.floor(c.row) : 1,
    }));

  if (!clean.some((c: { id: string }) => c.id === "done")) clean.push({ id: "done", label: "Done", row: 1 });

  await prisma.user.update({ where: { id: session.user.id }, data: { boardColumns: clean } });
  return NextResponse.json(clean);
}
