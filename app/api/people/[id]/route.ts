import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { CreatePersonSchema, URLIdSchema, parseBody, wrapHandler } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const personId = idParsed.data;

    const parsed = parseBody(CreatePersonSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const result = await db.person.updateMany({
      where: { id: personId, userId },
      data: { name: parsed.data.name },
    });
    if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(await db.person.findUnique({ where: { id: personId } }));
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const personId = idParsed.data;

    await db.person.deleteMany({ where: { id: personId, userId } });
    return NextResponse.json({ ok: true });
  });
}
