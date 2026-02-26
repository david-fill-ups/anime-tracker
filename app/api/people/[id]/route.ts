import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { name } = await req.json();
  const person = await db.person.update({ where: { id: Number(id) }, data: { name } });
  return NextResponse.json(person);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await db.person.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
