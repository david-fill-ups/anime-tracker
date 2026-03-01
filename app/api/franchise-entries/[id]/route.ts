import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  await requireUserId();
  const { id } = await params;
  await db.franchiseEntry.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
