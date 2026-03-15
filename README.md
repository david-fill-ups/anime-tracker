# Anime Tracker

A personal anime tracking app built with Next.js. Track what you're watching, organize series into linked seasons, group them into franchises, and record who recommended them.

## Features

- **Library** — Track anime by status (Watching, Completed, Dropped, Plan to Watch, Not Interested)
- **Links** — Group sequel seasons under a single watch entry with a cumulative episode counter
- **Franchises** — Organize related series across links; auto-populated from AniList relation data
- **People** — Record who recommended each anime; see recommendation quality stats
- **AniList sync** — Import metadata (title, cover, episodes, airing status, genres) from AniList
- **Streaming links** — Auto-fetch where-to-watch data via TMDB
- **Import/Export** — CSV round-trip for full library portability
- **API docs** — OpenAPI 3.1 spec served at `/api/openapi`, rendered at `/docs` (authenticated)

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, TypeScript)
- **Database**: PostgreSQL via [Neon](https://neon.tech), accessed with Prisma 7
- **Auth**: NextAuth.js v5 with Google OAuth
- **Styling**: Tailwind CSS v4
- **Validation**: Zod v4
- **Testing**: Vitest

## Local Setup

### Prerequisites

- Node.js 20+
- A PostgreSQL database (Neon free tier works)
- A Google OAuth app (for sign-in)
- Optional: TMDB API key (for streaming link data)

### Environment Variables

Create `.env.local` with:

```env
DATABASE_URL=postgresql://...
AUTH_SECRET=<random-secret>          # generate with: openssl rand -base64 32
AUTH_GOOGLE_ID=<google-client-id>
AUTH_GOOGLE_SECRET=<google-client-secret>
TMDB_API_KEY=<tmdb-api-key>          # optional — streaming links won't populate without it
```

### Install & Run

```bash
npm install                          # also runs prisma generate
npx prisma db push                   # sync schema to your database
npm run dev                          # start dev server at http://localhost:3000
```

### Build

```bash
npm run build                        # prisma generate + tests + next build
```

## Database

The schema lives in `prisma/schema.prisma`. The Prisma client is generated into `app/generated/prisma/` (custom output, committed to the repo).

To apply schema changes to your database:

```bash
npx prisma db push                   # push directly (no migration history)
npx prisma generate                  # regenerate client after schema edits
node scripts/create-prisma-barrel.mjs  # regenerate the barrel export
```

## Testing

```bash
npm test                             # run all tests once
npm run test:watch                   # watch mode
```

Tests live in `tests/lib/` and cover the utility/mapping functions in `lib/`.

## API

The full REST API is documented at `/docs` when signed in. The raw OpenAPI JSON is at `/api/openapi`.

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/anime` | Add anime to library (AniList or manual) |
| `PATCH` | `/api/anime/{id}` | Update watch status, score, metadata |
| `POST` | `/api/anime/{id}/sync` | Re-sync metadata from AniList |
| `POST` | `/api/sync-all` | Sync entire library (5-min cooldown) |
| `POST` | `/api/import` | Import from CSV |
| `GET` | `/api/export` | Export library as CSV |
| `GET` | `/api/franchises` | List franchises (paginated) |
| `GET` | `/api/people` | List people (paginated) |
