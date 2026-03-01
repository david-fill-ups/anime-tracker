const ANILIST_URL = "https://graphql.anilist.co";
const Q = `
  query SearchAnime($search: String!) {
    Page(page: 1, perPage: 5) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title { romaji english }
        status
        format
      }
    }
  }
`;
async function search(s) {
  const r = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: Q, variables: { search: s } }),
  });
  if (!r.ok) { console.log("HTTP", r.status); return []; }
  const d = await r.json();
  if (d.errors) { console.log("ERR:", d.errors[0]?.message); return []; }
  return d.data?.Page?.media ?? [];
}

const tries = [
  "Jack of All Trades",
  "Bannou Skill",
  "Arcane netflix",
  "DOTA Dragon",
  "Dragon's Blood",
];
for (const term of tries) {
  const r = await search(term);
  console.log(`"${term}" =>`, r.map(x=>`[${x.id}] ${x.title.romaji} / ${x.title.english} (${x.format})`).join(" | ") || "no results");
  await new Promise(res => setTimeout(res, 800));
}
