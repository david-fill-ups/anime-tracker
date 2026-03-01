import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import type { WatchStatus } from "@/app/generated/prisma";

type Params = { params: Promise<{ id: string }> };

// Create or update a UserEntry for an existing anime (used by recommendations)
export async function POST(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  const { id } = await params;
  const animeId = Number(id);
  const body = await req.json();

  const entry = await db.userEntry.upsert({
    where: { animeId_userId: { animeId, userId } },
    create: {
      animeId,
      userId,
      watchStatus: body.watchStatus as WatchStatus,
    },
    update: {
      watchStatus: body.watchStatus as WatchStatus,
    },
  });

  return NextResponse.json(entry);
}

// Remove a UserEntry (undo Not Interested / remove from queue)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  const { id } = await params;
  const animeId = Number(id);

  try {
    await db.userEntry.delete({ where: { animeId_userId: { animeId, userId } } });
  } catch {
    // Entry may not exist — that's fine
  }

  return NextResponse.json({ ok: true });
}
