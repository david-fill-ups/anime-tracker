import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { StreamingService } from "@/app/generated/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const links = await db.streamingLink.findMany({
    where: { animeId: Number(id) },
    orderBy: { service: "asc" },
  });
  return NextResponse.json(links);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { service, url } = await req.json();

  if (!service || !url) {
    return NextResponse.json({ error: "service and url are required" }, { status: 400 });
  }

  const link = await db.streamingLink.upsert({
    where: { animeId_service: { animeId: Number(id), service: service as StreamingService } },
    update: { url },
    create: { animeId: Number(id), service: service as StreamingService, url },
  });

  return NextResponse.json(link, { status: 201 });
}
