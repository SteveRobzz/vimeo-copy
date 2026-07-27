# Deployment (Step 8)

Deploys **Loop** to: **Vercel** (Next.js web), **Railway** (transcode worker + Postgres + Redis), **Cloudflare R2** (object storage).

> **Demo posture:** there is no real auth yet — every visitor acts as the single
> `dev@local.test` user and can upload/delete/view the Studio. Share the URL
> accordingly. Captions (Whisper) are **disabled in prod** (`ENABLE_CAPTIONS=false`)
> to keep the worker image slim.

Do the phases in order — each produces secrets the next one needs.

---

## Phase 1 — Provision data stores (you)

### 1a. Cloudflare R2
1. Cloudflare dashboard → **R2** → *Create bucket* → name it `vp-media` (or anything; note it).
2. **R2 → Manage API Tokens → Create API Token** (Object Read & Write). Save:
   - Access Key ID, Secret Access Key
   - Account ID (the endpoint is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)
3. Leave CORS for **Phase 5** (needs the Vercel domain).

### 1b. Railway Postgres + Redis
1. [railway.com](https://railway.com) → *New Project*.
2. **+ New → Database → PostgreSQL**. Open it → **Variables/Connect** → copy the **public** `DATABASE_URL` (has host + `sslmode` — used by Vercel *and* by the migration in Phase 2).
3. **+ New → Database → Redis**. Copy the **public** `REDIS_URL`.

Collect these secrets (used repeatedly below):

| Var | Value |
|---|---|
| `DATABASE_URL` | Railway Postgres public URL |
| `REDIS_URL` | Railway Redis public URL |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY_ID` | R2 access key |
| `S3_SECRET_ACCESS_KEY` | R2 secret key |
| `S3_BUCKET` | `vp-media` |
| `S3_FORCE_PATH_STYLE` | `false` |
| `STREAM_SIGNING_SECRET` | generate once: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

---

## Phase 2 — Migrate the prod database (Claude runs this for you)

From the repo, pointed at the Railway Postgres URL:

```bash
DATABASE_URL="<railway postgres public url>" pnpm db:migrate:deploy
```

Applies all Prisma migrations to the empty prod DB. **No seed needed** — the app
upserts `dev@local.test` on the first request. Verify with `pnpm db:studio`
(same `DATABASE_URL`) if you want to eyeball the tables.

---

## Phase 3 — Deploy the worker to Railway (you; config already in repo)

The repo ships `railway.json` + `apps/worker/Dockerfile` (Node + FFmpeg, built
from the repo root).

1. In the same Railway project: **+ New → GitHub Repo → `SteveRobzz/vimeo-copy`**.
2. Railway auto-detects `railway.json` (Dockerfile build). No root-dir change needed.
3. Add **Variables** to this service (all of Phase 1's table) **plus**:

   | Var | Value |
   |---|---|
   | `WORKER_CONCURRENCY` | `1` |
   | `FFMPEG_PRESET` | `veryfast` |
   | `ENABLE_CAPTIONS` | `false` |

4. Deploy. **Logs should show `transcode worker up`** and no Redis/DB errors.

---

## Phase 4 — Deploy web to Vercel (you)

1. [vercel.com](https://vercel.com) → *Add New → Project* → import `SteveRobzz/vimeo-copy`.
2. **Root Directory → `apps/web`** (keep *"Include files outside the root directory"* ON — it's a pnpm workspace).
3. Framework preset: **Next.js** (auto). Build/install commands: **defaults** — `prisma generate` runs via `@vp/db` postinstall.
4. **Environment Variables** — add every row from Phase 1's table (`DATABASE_URL`, `REDIS_URL`, all `S3_*`, `STREAM_SIGNING_SECRET`).
5. Deploy. Note the assigned domain, e.g. `loop-xxxx.vercel.app`.

---

## Phase 5 — R2 CORS (you; needed for browser uploads)

Uppy PUTs upload parts **directly** from the browser to R2, so R2 must allow the
Vercel origin (without this, uploads fail with a CORS error).

1. Edit `deploy/r2-cors.json` → replace the placeholder with your real Vercel
   domain (add a custom domain later if you get one).
2. Cloudflare **R2 → your bucket → Settings → CORS Policy → Edit** → paste the JSON.

---

## Phase 6 — Smoke test (together)

On the real Vercel URL:
1. **Upload** a short clip (visibility Public) → upload completes (proves R2 + CORS).
2. Worker **Railway logs** show `job started` → `job completed` (proves DB/Redis/R2 wiring).
3. Video flips to **READY**; open **Watch** → it plays through the `/api/stream`
   proxy with signed `?t=` tokens (proves Step 7 in prod).
4. **Studio** (`/dashboard`) shows the video and records a view.

---

## Known follow-ups (not blocking this deploy)
- **Auth:** single shared dev user — add a login before any real/public use.
- **Streaming cost/CDN:** segments currently stream through the Vercel `/api/stream`
  function (Vercel egress per request). Front R2 with the Cloudflare CDN + a public
  bucket/custom domain to offload bandwidth when traffic grows.
- **DB connections:** Prisma opens a connection per serverless invocation; add
  Prisma Accelerate or a pooler (pgbouncer) if you hit Postgres connection limits.
- **iOS Safari:** native-HLS path doesn't carry tokens to segments → private-video
  playback on iOS needs signed cookies (noted in Step 7).
