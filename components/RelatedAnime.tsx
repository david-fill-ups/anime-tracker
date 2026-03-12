import { fetchAniListById } from "@/lib/anilist";
import { db } from "@/lib/db";
import AddRelatedAnimeButton from "./AddRelatedAnimeButton";

const RELATION_LABELS: Record<string, string> = {
  PREQUEL: "Prequel",
  SEQUEL: "Sequel",
  PARENT: "Parent Story",
  SIDE_STORY: "Side Story",
  SPIN_OFF: "Spin-off",
  ALTERNATIVE: "Alternative",
  SOURCE: "Source Material",
};

const RELATION_ORDER = ["PREQUEL", "SEQUEL", "PARENT", "SIDE_STORY", "SPIN_OFF", "ALTERNATIVE", "SOURCE"];

export default async function RelatedAnime({
  anilistId,
  userId,
  franchiseIds,
  linkId,
  linkedAnilistIds,
}: {
  anilistId: number;
  userId: string;
  franchiseIds?: number[];
  linkId?: number | null;
  linkedAnilistIds?: (number | null)[];
}) {
  const [anilistData, userAnimes, franchiseMembers] = await Promise.all([
    fetchAniListById(anilistId),
    db.anime.findMany({
      where: { linkedIn: { some: { link: { userId } } }, anilistId: { not: null } },
      select: { anilistId: true },
    }),
    franchiseIds && franchiseIds.length > 0
      ? db.franchiseEntry.findMany({
          where: { franchiseId: { in: franchiseIds }, anime: { anilistId: { not: null } } },
          select: { anime: { select: { anilistId: true } } },
        })
      : Promise.resolve([]),
  ]);

  if (!anilistData) return null;

  const seenIds = new Set(userAnimes.map((a) => a.anilistId));
  for (const fm of franchiseMembers) {
    if (fm.anime.anilistId) seenIds.add(fm.anime.anilistId);
  }
  // Exclude already-linked anime so they don't appear as "related"
  for (const id of linkedAnilistIds ?? []) {
    if (id) seenIds.add(id);
  }

  const related = anilistData.relations.edges
    .filter(
      (e) =>
        e.node.type === "ANIME" &&
        e.relationType in RELATION_LABELS &&
        !seenIds.has(e.node.id)
    )
    .sort(
      (a, b) =>
        RELATION_ORDER.indexOf(a.relationType) - RELATION_ORDER.indexOf(b.relationType)
    );

  if (related.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-300 mb-3">Related Anime</h3>
      <div className="space-y-2">
        {related.map((e) => {
          const title = e.node.title.english || e.node.title.romaji;
          const label = RELATION_LABELS[e.relationType];
          return (
            <div
              key={e.node.id}
              className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 hover:border-slate-600 transition-colors"
            >
              <a
                href={`https://anilist.co/anime/${e.node.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 flex-1 min-w-0"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{title}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
                <span className="text-xs text-indigo-400 flex-shrink-0">AniList ↗</span>
              </a>
              <AddRelatedAnimeButton anilistId={e.node.id} linkId={linkId ?? null} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
