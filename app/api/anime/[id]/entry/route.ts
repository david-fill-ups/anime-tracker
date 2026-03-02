import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { URLIdSchema, UpdateUserEntrySchema, parseBody, wrapHandler } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

// Create or update a UserEntry for an existing anime (used by recommendations)
export async function POST(req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const animeId = idParsed.data;

    const parsed = parseBody(UpdateUserEntrySchema, await req.json());
    if (!parsed.success) return parsed.response;

    const entry = await db.userEntry.upsert({
      where: { animeId_userId: { animeId, userId } },
      create: { animeId, userId, watchStatus: parsed.data.watchStatus },
      update: { watchStatus: parsed.data.watchStatus },
    });

    return NextResponse.json(entry);
  });
}

// Remove a UserEntry (undo Not Interested / remove from queue)
export async function DELETE(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const animeId = idParsed.data;

    try {
      await db.userEntry.delete({ where: { animeId_userId: { animeId, userId } } });
    } catch {
      // Entry may not exist — that's fine
    }

    return NextResponse.json({ ok: true });
  });
}
