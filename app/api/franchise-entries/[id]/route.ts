import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await db.franchiseEntry.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
