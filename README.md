# Video Platform (Vimeo-style MVP)

Monorepo (pnpm workspaces). Web app deploys to Vercel; the transcode worker
(added in Step 4) deploys to Railway. Shared code lives in `packages/*`.

```
apps/
  web/        Next.js App Router (Vercel)
  worker/     BullMQ consumer + FFmpeg + Whisper (Railway)   [added in Step 4]
packages/
  db/         Prisma schema + client (source of truth for both apps)
  core/       Shared job contracts, queue names, quality ladder
```

## Local setup

Prereqs: Node 20+, pnpm 9+, Docker (for local Postgres/Redis).

```bash
# 1. Start local Postgres + Redis
docker compose up -d

# 2. Install deps (runs prisma generate via postinstall)
pnpm install

# 3. Point Prisma at the local DB, then create the schema
cp packages/db/.env.example packages/db/.env
pnpm db:migrate           # creates the initial migration + tables

# 4. Run the web app
cp apps/web/.env.example apps/web/.env.local
pnpm dev:web              # http://localhost:3000
```

Quick checks:
- `http://localhost:3000` — scaffold landing page
- `http://localhost:3000/api/health` — `{ "ok": true }`
- `pnpm db:studio` — browse the (empty) tables
