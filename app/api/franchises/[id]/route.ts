import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import type { FranchiseEntryType } from "@/app/generated/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  const { id } = await params;
  const franchise = await db.franchise.findFirst({
    where: { id: Number(id), userId },
    include: {
      entries: {
        orderBy: { order: "asc" },
        include: {
          anime: {
            include: {
              userEntries: { where: { userId }, take: 1 },
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
        userEntry: e.anime.userEntries[0] ?? null,
        userEntries: undefined,
      },
    })),
  };

  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  const { id } = await params;
  const body = await req.json();
  const franchise = await db.franchise.updateMany({
    where: { id: Number(id), userId },
    data: {
      name: body.name,
      description: body.description,
    },
  });
  if (franchise.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await db.franchise.findUnique({ where: { id: Number(id) } }));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  const { id } = await params;
  await db.franchise.deleteMany({ where: { id: Number(id), userId } });
  return NextResponse.json({ ok: true });
}

// POST /api/franchises/[id] adds an anime to the franchise
export async function POST(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  const { id } = await params;

  // Verify the franchise belongs to this user
  const franchise = await db.franchise.findFirst({ where: { id: Number(id), userId } });
  if (!franchise) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { animeId, order, entryType } = await req.json();

  const entry = await db.franchiseEntry.create({
    data: {
      franchiseId: Number(id),
      animeId: Number(animeId),
      order: Number(order),
      entryType: (entryType as FranchiseEntryType) ?? "MAIN",
    },
  });
  return NextResponse.json(entry, { status: 201 });
}
