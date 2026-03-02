import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { CreateFranchiseSchema, parseBody, wrapHandler } from "@/lib/validation";

export async function GET() {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const franchises = await db.franchise.findMany({
      where: { userId },
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
      orderBy: { name: "asc" },
    });

    // Transform nested userEntries[] -> userEntry for frontend compatibility
    const result = franchises.map((f) => ({
      ...f,
      entries: f.entries.map((e) => ({
        ...e,
        anime: {
          ...e.anime,
          userEntry: e.anime.userEntries[0] ?? null,
          userEntries: undefined,
        },
      })),
    }));

    return NextResponse.json(result);
  });
}

export async function POST(req: NextRequest) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const parsed = parseBody(CreateFranchiseSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { name, description } = parsed.data;
    const franchise = await db.franchise.create({ data: { name, description, userId } });
    return NextResponse.json(franchise, { status: 201 });
  });
}
