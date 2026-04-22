import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Papa from "papaparse";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const accountId = formData.get("accountId") as string;
    const dateCol = formData.get("dateCol") as string;
    const amountCol = formData.get("amountCol") as string;
    const descCol = formData.get("descCol") as string;
    const typeMode = formData.get("typeMode") as string;
    const typeCol = formData.get("typeCol") as string | null;

    if (!file || !accountId) {
      return NextResponse.json({ error: "Missing file or accountId" }, { status: 400 });
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { currency: true },
    });
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const text = await file.text();
    const fileType = file.name.endsWith(".csv") ? "csv" : "pdf";

    if (fileType !== "csv") {
      return NextResponse.json({ error: "PDF parsing not yet supported. Use CSV." }, { status: 400 });
    }

    const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    const rows = result.data;

    // Parse rows first, validate all before touching DB
    type ParsedRow = { type: string; amount: number; date: Date; description: string; delta: number };
    const parsed: ParsedRow[] = [];

    for (const row of rows) {
      const rawDate = row[dateCol];
      const rawAmount = row[amountCol]?.replace(/[^0-9.-]/g, "");
      const description = row[descCol] ?? "";

      if (!rawDate || !rawAmount) continue;
      const parsedDate = new Date(rawDate);
      if (isNaN(parsedDate.getTime())) continue;
      const amount = Math.abs(parseFloat(rawAmount));
      if (isNaN(amount) || amount === 0) continue;

      let type = "expense";
      if (typeMode === "sign") {
        type = parseFloat(rawAmount) >= 0 ? "income" : "expense";
      } else if (typeMode === "col" && typeCol) {
        const val = row[typeCol]?.toLowerCase() ?? "";
        type = val.includes("credit") || val === "in" || val === "income" ? "income" : "expense";
      }

      parsed.push({ type, amount, date: parsedDate, description, delta: type === "income" ? amount : -amount });
    }

    if (parsed.length === 0) {
      return NextResponse.json({ error: "No valid rows found in file" }, { status: 400 });
    }

    // Run everything in one atomic transaction
    const totalDelta = parsed.reduce((sum, r) => sum + r.delta, 0);

    const importRecord = await prisma.$transaction(async (tx) => {
      const imp = await tx.statementImport.create({
        data: { accountId, fileName: file.name, fileType },
      });

      await tx.transaction.createMany({
        data: parsed.map(r => ({
          type: r.type,
          amount: r.amount,
          currencyId: account.currencyId,
          accountId,
          date: r.date,
          description: r.description,
          source: "import",
          importId: imp.id,
        })),
      });

      await tx.account.update({
        where: { id: accountId },
        data: { balance: { increment: totalDelta } },
      });

      return imp;
    });

    return NextResponse.json({ imported: parsed.length, importId: importRecord.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const text = await file.text();
    const result = Papa.parse<Record<string, string>>(text, { header: true, preview: 5, skipEmptyLines: true });

    return NextResponse.json({ columns: result.meta.fields ?? [], preview: result.data });
  } catch {
    return NextResponse.json({ error: "Failed to parse file" }, { status: 500 });
  }
}
