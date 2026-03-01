import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

type Params = { params: Promise<{ linkId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  await requireUserId();
  const { linkId } = await params;
  await db.streamingLink.delete({ where: { id: Number(linkId) } });
  return NextResponse.json({ ok: true });
}
