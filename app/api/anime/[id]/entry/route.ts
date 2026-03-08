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

    // Find existing Link for this anime
    const link = await db.link.findFirst({
      where: { userId, linkedAnime: { some: { animeId } } },
      select: { id: true, userEntry: { select: { id: true } } },
    });

    if (link?.userEntry) {
      // Update existing entry
      const entry = await db.userEntry.update({
        where: { linkId: link.id },
        data: { watchStatus: parsed.data.watchStatus },
      });
      return NextResponse.json(entry);
    }

    if (link) {
      // Link exists but no UserEntry — create one
      const entry = await db.userEntry.create({
        data: { linkId: link.id, userId, watchStatus: parsed.data.watchStatus },
      });
      return NextResponse.json(entry);
    }

    // No link at all — create Link + LinkedAnime + UserEntry
    const newLink = await db.link.create({
      data: {
        userId,
        linkedAnime: { create: { animeId, order: 0 } },
        userEntry: { create: { userId, watchStatus: parsed.data.watchStatus } },
      },
      include: { userEntry: true },
    });
    return NextResponse.json(newLink.userEntry);
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

    const link = await db.link.findFirst({
      where: { userId, linkedAnime: { some: { animeId } } },
      select: { id: true },
    });

    if (link) {
      try {
        await db.userEntry.delete({ where: { linkId: link.id } });
      } catch {
        // Entry may not exist — that's fine
      }
    }

    return NextResponse.json({ ok: true });
  });
}
