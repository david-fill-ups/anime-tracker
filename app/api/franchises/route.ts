import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const franchises = await db.franchise.findMany({
    include: {
      entries: {
        orderBy: { order: "asc" },
        include: {
          anime: {
            include: {
              userEntry: true,
              animeStudios: { include: { studio: true } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(franchises);
}

export async function POST(req: NextRequest) {
  const { name, description } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const franchise = await db.franchise.create({ data: { name, description } });
  return NextResponse.json(franchise, { status: 201 });
}
