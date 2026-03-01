import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

export async function GET() {
  const userId = await requireUserId();
  const people = await db.person.findMany({
    where: { userId },
    include: {
      entries: {
        include: { anime: true },
        where: { watchStatus: "COMPLETED", userId },
      },
    },
    orderBy: { name: "asc" },
  });

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

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const person = await db.person.create({ data: { name, userId } });
  return NextResponse.json(person, { status: 201 });
}
