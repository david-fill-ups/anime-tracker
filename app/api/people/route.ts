import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { CreatePersonSchema, parseBody, wrapHandler } from "@/lib/validation";
import { PAGINATION } from "@/lib/pagination";

export async function GET(req: NextRequest) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      PAGINATION.people.max,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(PAGINATION.people.default), 10) || PAGINATION.people.default)
    );
    const skip = (page - 1) * limit;

    const [people, total] = await Promise.all([
      db.person.findMany({
        where: { userId },
        include: {
          entries: {
            where: { watchStatus: "COMPLETED", userId },
            select: { score: true },
          },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      db.person.count({ where: { userId } }),
    ]);

    // Compute recommendation quality per person
    const result = people.map((person) => {
      const rated = person.entries.filter((e) => e.score !== null);
      const avgScore = rated.length
        ? rated.reduce((sum, e) => sum + (e.score ?? 0), 0) / rated.length
        : null;
      return {
        id: person.id,
        name: person.name,
        totalRecommendations: person.entries.length,
        ratedCount: rated.length,
        avgScore: avgScore ? Math.round(avgScore * 10) / 10 : null,
      };
    });

    return NextResponse.json({ data: result, total, page, limit, pages: Math.ceil(total / limit) });
  });
}

export async function POST(req: NextRequest) {
  return wrapHandler(async () => {
    const userId = await requireUserId();
    const parsed = parseBody(CreatePersonSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const person = await db.person.create({ data: { name: parsed.data.name, userId } });
    return NextResponse.json(person, { status: 201 });
  });
}
