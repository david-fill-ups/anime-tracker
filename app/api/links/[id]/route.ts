import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { URLIdSchema, wrapHandler } from "@/lib/validation";
import { LINKED_ANIME_SELECT } from "@/lib/anime-utils";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const LINK_INCLUDE = {
  linkedAnime: {
    include: { anime: { select: LINKED_ANIME_SELECT } },
    orderBy: { order: "asc" as const },
  },
  userEntry: { include: { recommender: true, watchContextPerson: true } },
} as const;

export async function GET(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const link = await db.link.findFirst({
      where: { id: idParsed.data, userId },
      include: LINK_INCLUDE,
    });
    if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(link);
  });
}

const PatchLinkSchema = z.object({ name: z.string().nullable() });

export async function PATCH(req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = PatchLinkSchema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const link = await db.link.findFirst({ where: { id: idParsed.data, userId } });
    if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await db.link.update({
      where: { id: idParsed.data },
      data: { name: body.data.name },
      include: LINK_INCLUDE,
    });
    return NextResponse.json(updated);
  });
}
