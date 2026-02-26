import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { FranchiseEntryType } from "@/app/generated/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const franchise = await db.franchise.findUnique({
    where: { id: Number(id) },
    include: {
      entries: {
        orderBy: { order: "asc" },
        include: {
          anime: {
            include: {
              userEntry: true,
              animeStudios: { include: { studio: true } },
            },
          },
        },
      },
    },
  });
  if (!franchise) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(franchise);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const franchise = await db.franchise.update({
    where: { id: Number(id) },
    data: {
      name: body.name,
      description: body.description,
    },
  });
  return NextResponse.json(franchise);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await db.franchise.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}

// POST /api/franchises/[id] with action=addEntry adds an anime to the franchise
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
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
