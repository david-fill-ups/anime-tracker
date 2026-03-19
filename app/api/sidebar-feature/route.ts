import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { wrapHandler } from "@/lib/validation";

export async function GET() {
  return wrapHandler(async () => {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ anime: null });

    const count = await db.link.count({
      where: {
        userId: session.user.id,
        userEntry: { is: { watchStatus: "COMPLETED" } },
        linkedAnime: { some: { order: 0, anime: { coverImageUrl: { not: null } } } },
      },
    });

    if (count === 0) return NextResponse.json({ anime: null });

    const skip = Math.floor(Math.random() * count);
    const link = await db.link.findFirst({
      where: {
        userId: session.user.id,
        userEntry: { is: { watchStatus: "COMPLETED" } },
        linkedAnime: { some: { order: 0, anime: { coverImageUrl: { not: null } } } },
      },
      skip,
      select: {
        userEntry: { select: { score: true } },
        linkedAnime: {
          where: { order: 0 },
          take: 1,
          select: { anime: { select: { titleEnglish: true, titleRomaji: true, coverImageUrl: true } } },
        },
      },
    });

    const anime = link?.linkedAnime[0]?.anime ?? null;
    return NextResponse.json({
      anime: anime
        ? {
            coverImageUrl: anime.coverImageUrl!,
            title: anime.titleEnglish ?? anime.titleRomaji,
            score: link?.userEntry?.score ?? null,
          }
        : null,
    });
  });
}
