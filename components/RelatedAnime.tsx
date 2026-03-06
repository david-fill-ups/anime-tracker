import { fetchAniListById } from "@/lib/anilist";
import { db } from "@/lib/db";

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
}: {
  anilistId: number;
  userId: string;
}) {
  const [anilistData, userAnimes] = await Promise.all([
    fetchAniListById(anilistId),
    db.anime.findMany({
      where: { userEntries: { some: { userId } }, anilistId: { not: null } },
      select: { anilistId: true },
    }),
  ]);

  if (!anilistData) return null;

  const seenIds = new Set(userAnimes.map((a) => a.anilistId));

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
            <a
              key={e.node.id}
              href={`https://anilist.co/anime/${e.node.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 hover:border-slate-600 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{title}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
              <span className="text-xs text-indigo-400 flex-shrink-0">AniList ↗</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
