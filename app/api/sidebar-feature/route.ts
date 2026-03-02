import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ anime: null });

  const count = await db.userEntry.count({
    where: {
      userId: session.user.id,
      watchStatus: "COMPLETED",
      anime: { coverImageUrl: { not: null } },
    },
  });

  if (count === 0) return NextResponse.json({ anime: null });

  const skip = Math.floor(Math.random() * count);
  const entry = await db.userEntry.findFirst({
    where: {
      userId: session.user.id,
      watchStatus: "COMPLETED",
      anime: { coverImageUrl: { not: null } },
    },
    skip,
    select: {
      score: true,
      anime: {
        select: { titleEnglish: true, titleRomaji: true, coverImageUrl: true },
      },
    },
  });

  return NextResponse.json({
    anime: entry
      ? {
          coverImageUrl: entry.anime.coverImageUrl!,
          title: entry.anime.titleEnglish ?? entry.anime.titleRomaji,
          score: entry.score ?? null,
        }
      : null,
  });
}
