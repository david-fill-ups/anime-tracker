import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  const { id } = await params;
  const { name } = await req.json();
  const result = await db.person.updateMany({ where: { id: Number(id), userId }, data: { name } });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await db.person.findUnique({ where: { id: Number(id) } }));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  const { id } = await params;
  await db.person.deleteMany({ where: { id: Number(id), userId } });
  return NextResponse.json({ ok: true });
}
