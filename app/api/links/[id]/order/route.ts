import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { URLIdSchema, wrapHandler } from "@/lib/validation";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const OrderSchema = z.object({ orderedAnimeIds: z.array(z.number().int().positive()) });

// PATCH { orderedAnimeIds: number[] } — reorder linked anime by animeId
export async function PATCH(req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const linkId = idParsed.data;

    const body = OrderSchema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: "orderedAnimeIds must be number[]" }, { status: 400 });

    const link = await db.link.findFirst({
      where: { id: linkId, userId },
      include: { linkedAnime: { select: { id: true, animeId: true } } },
    });
    if (!link) return NextResponse.json({ error: "Not in your library" }, { status: 403 });

    const { orderedAnimeIds } = body.data;

    await db.$transaction(
      orderedAnimeIds.map((animeId, i) => {
        const la = link.linkedAnime.find((x) => x.animeId === animeId);
        if (!la) return db.linkedAnime.findFirst({ where: { linkId } }); // no-op placeholder
        return db.linkedAnime.update({ where: { id: la.id }, data: { order: i } });
      })
    );

    return NextResponse.json({ ok: true });
  });
}
