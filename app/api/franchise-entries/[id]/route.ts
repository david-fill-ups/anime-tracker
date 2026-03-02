import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { URLIdSchema, wrapHandler } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    await db.franchiseEntry.delete({ where: { id: idParsed.data } });
    return NextResponse.json({ ok: true });
  });
}
