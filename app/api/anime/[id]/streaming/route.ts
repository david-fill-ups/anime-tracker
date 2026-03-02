import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { URLIdSchema, CreateStreamingLinkSchema, parseBody, wrapHandler } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const animeId = idParsed.data;

    const links = await db.streamingLink.findMany({
      where: { animeId },
      orderBy: { service: "asc" },
    });
    return NextResponse.json(links);
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  return wrapHandler(async () => {
    await requireUserId();
    const { id } = await params;
    const idParsed = URLIdSchema.safeParse(id);
    if (!idParsed.success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const animeId = idParsed.data;

    const parsed = parseBody(CreateStreamingLinkSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { service, url } = parsed.data;

    const link = await db.streamingLink.upsert({
      where: { animeId_service: { animeId, service } },
      update: { url },
      create: { animeId, service, url },
    });

    return NextResponse.json(link, { status: 201 });
  });
}
