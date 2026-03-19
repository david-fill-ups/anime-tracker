import { NextRequest, NextResponse } from "next/server";
import { wrapHandler, URLIdSchema } from "@/lib/validation";
import { requireUserId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

type Params = { params: Promise<{ linkId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { linkId } = await params;
    const streamingLinkId = URLIdSchema.parse(linkId);

    const streamingLink = await db.streamingLink.findUnique({
      where: { id: streamingLinkId },
      select: {
        anime: {
          select: {
            linkedIn: {
              where: { link: { userId } },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    });

    if (!streamingLink || streamingLink.anime.linkedIn.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.streamingLink.delete({ where: { id: streamingLinkId } });
    return NextResponse.json({ ok: true });
  });
}
