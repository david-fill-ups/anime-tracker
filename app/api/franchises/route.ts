import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { CreateFranchiseSchema, parseBody, wrapHandler } from "@/lib/validation";
import { PAGINATION } from "@/lib/pagination";

export async function GET(req: NextRequest) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      PAGINATION.franchises.max,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(PAGINATION.franchises.default), 10) || PAGINATION.franchises.default)
    );
    const skip = (page - 1) * limit;

    const [franchises, total] = await Promise.all([
      db.franchise.findMany({
        where: { userId },
        include: {
          entries: {
            orderBy: { order: "asc" },
            include: {
              anime: {
                include: {
                  linkedIn: {
                    where: { link: { userId } },
                    include: { link: { include: { userEntry: true } } },
                    take: 1,
                  },
                  animeStudios: { include: { studio: true } },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      db.franchise.count({ where: { userId } }),
    ]);

    // Transform nested userEntries[] -> userEntry for frontend compatibility
    const data = franchises.map((f) => ({
      ...f,
      entries: f.entries.map((e) => ({
        ...e,
        anime: {
          ...e.anime,
          userEntry: e.anime.linkedIn[0]?.link.userEntry ?? null,
          linkedIn: undefined,
        },
      })),
    }));

    return NextResponse.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
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
