import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { URLIdSchema, UpdateFranchiseSchema, AddAnimeToFranchiseSchema, parseBody, wrapHandler } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const franchise = await db.franchise.findFirst({
      where: { id: idParsed.data, userId },
      include: {
        entries: {
          orderBy: { order: "asc" },
          include: {
            anime: {
              include: {
                linkedIn: {
                  where: { link: { userId } },
                  include: { link: { include: { userEntry: true } } },
                  take: 1,
                },
                animeStudios: { include: { studio: true } },
              },
            },
          },
        },
      },
    });
    if (!franchise) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const result = {
      ...franchise,
      entries: franchise.entries.map((e) => ({
        ...e,
        anime: {
          ...e.anime,
          userEntry: e.anime.linkedIn[0]?.link.userEntry ?? null,
          linkedIn: undefined,
        },
      })),
    };

    return NextResponse.json(result);
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const parsed = parseBody(UpdateFranchiseSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const franchise = await db.franchise.updateMany({
      where: { id: idParsed.data, userId },
      data: { name: parsed.data.name, description: parsed.data.description },
    });
    if (franchise.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(await db.franchise.findUnique({ where: { id: idParsed.data } }));
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    await db.franchise.deleteMany({ where: { id: idParsed.data, userId } });
    return NextResponse.json({ ok: true });
  });
}

// POST /api/franchises/[id] adds an anime to the franchise
export async function POST(req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    // Verify the franchise belongs to this user
    const franchise = await db.franchise.findFirst({ where: { id: idParsed.data, userId } });
    if (!franchise) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = parseBody(AddAnimeToFranchiseSchema, await req.json());
    if (!parsed.success) return parsed.response;

    let order = parsed.data.order;
    if (order === undefined) {
      const lastEntry = await db.franchiseEntry.findFirst({
        where: { franchiseId: idParsed.data },
        orderBy: { order: "desc" },
      });
      order = (lastEntry?.order ?? 0) + 1;
    }

    const entry = await db.franchiseEntry.create({
      data: {
        franchiseId: idParsed.data,
        animeId: parsed.data.animeId,
        order,
        entryType: parsed.data.entryType ?? "MAIN",
      },
    });
    return NextResponse.json(entry, { status: 201 });
  });
}
