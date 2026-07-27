# Deployment (Step 8)

Deploys **vimeo(copy)** on a **fully card-free** stack:

| Piece | Service | Card? |
|---|---|---|
| Web (Next.js) | **Vercel** (Hobby) | No |
| Postgres **+** object storage | **Supabase** (one project) | No |
| Redis (BullMQ queue) | **Upstash** | No |
| Transcode worker (FFmpeg) | **Azure for Students** ($100 credit) | No |

> **Demo posture:** no real auth yet — every visitor acts as the single
> `dev@local.test` user (can upload/delete/view Studio). Captions (Whisper) are
> **off in prod** (`ENABLE_CAPTIONS=false`); the worker image is Node + FFmpeg only.

Do the phases in order — each produces secrets the next one needs.

---

## Phase 1 — Provision (you; no credit card anywhere)

### 1a. Supabase → Postgres + Storage
1. [supabase.com](https://supabase.com) → sign in with GitHub → **New project**. Pick a
   region near your users; set + **save the database password**.
2. **Project Settings → Database → Connection string**, grab two URIs:
   - **`DATABASE_URL`** = *Transaction pooler* (host `...pooler.supabase.com`, port **6543**). Append `&pgbouncer=true` if not present.
   - **`DIRECT_URL`** = *Direct connection* (port **5432**).
   (Both contain your DB password.)
3. **Storage → Create bucket** → name `vp-media` → keep **Private** (we proxy playback).
4. **Project Settings → Storage → S3 Connection**: note the **Endpoint**
   (`https://<project-ref>.supabase.co/storage/v1/s3`) and **Region**, then
   **generate S3 access keys** (Access Key ID + Secret).

### 1b. Upstash → Redis
1. [upstash.com](https://upstash.com) → sign in with GitHub → **Create Database** (Redis).
2. Copy the **`rediss://` URL** (TLS). That's your `REDIS_URL` — ioredis enables TLS automatically from the `rediss://` scheme.

### 1c. Azure for Students (for Phase 3 — start now, it can take a bit)
1. Get the **[GitHub Student Developer Pack](https://education.github.com/pack)** approved (verify with your school email).
2. Redeem **Azure for Students** → **$100 credit, 12 months, no card**.

**Collected secrets:**

| Var | Source |
|---|---|
| `DATABASE_URL` | Supabase transaction pooler URI (6543, `&pgbouncer=true`) |
| `DIRECT_URL` | Supabase direct URI (5432) |
| `REDIS_URL` | Upstash `rediss://` URL |
| `S3_ENDPOINT` | `https://<project-ref>.supabase.co/storage/v1/s3` |
| `S3_REGION` | region shown in Supabase Storage settings |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Supabase Storage S3 keys |
| `S3_BUCKET` | `vp-media` |
| `S3_FORCE_PATH_STYLE` | `true` |
| `STREAM_SIGNING_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

---

## Phase 2 — Migrate the prod database (Claude runs this)

```bash
DATABASE_URL="<supabase pooler url>" DIRECT_URL="<supabase direct url>" pnpm db:migrate:deploy
```

Prisma uses `DIRECT_URL` for the migration (the pooler can't run DDL). No seed
needed — the app upserts `dev@local.test` on first request.

---

## Phase 3 — Deploy the worker to Azure (you + Claude)

Built from `apps/worker/Dockerfile` (Node 20 + FFmpeg, repo-root context). Two routes:

- **Web App for Containers** (friendliest): deploy the image, set env vars as
  App Settings, runs always-on on a small plan (~B1) funded by the credit.
- **Azure Container Instances** (`az container create`): quickest via CLI.

Either way the image is built once (`docker build -f apps/worker/Dockerfile -t <registry>/vp-worker .`)
and pushed to a registry (GitHub Container Registry is free). **Env vars:** all of
Phase 1's table **plus** `WORKER_CONCURRENCY=1`, `FFMPEG_PRESET=veryfast`,
`ENABLE_CAPTIONS=false`. Healthy logs show `transcode worker up`.
*(We'll do this step together once your Azure credit is active.)*

---

## Phase 4 — Deploy web to Vercel (you)

1. [vercel.com](https://vercel.com) → import `SteveRobzz/vimeo-copy`.
2. **Root Directory → `apps/web`** (keep "Include files outside root directory" ON — it's a pnpm workspace).
3. Framework **Next.js** (auto); default build/install (`prisma generate` runs via `@vp/db` postinstall).
4. **Environment Variables:** every row from Phase 1's table (`DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, all `S3_*`, `STREAM_SIGNING_SECRET`).
5. Deploy; note the domain, e.g. `vimeo-copy-xxxx.vercel.app`.

---

## Phase 5 — Storage CORS (you; if browser uploads hit CORS)

Uppy PUTs upload parts directly from the browser to Supabase Storage. Supabase
allows cross-origin uploads by default; if a CORS error appears, add your Vercel
domain to the bucket/Storage CORS settings in the Supabase dashboard.

---

## Phase 6 — Smoke test (together)

On the real Vercel URL: upload a short clip → the **Azure worker logs** show
`job started` → `job completed` → video flips **READY** → **Watch** plays through
`/api/stream` with signed `?t=` tokens → **Studio** shows the video + a view.

---

## Known follow-ups (not blocking)
- **Auth:** single shared dev user — add login before real use.
- **Streaming/CDN:** segments stream through the Vercel `/api/stream` proxy;
  front storage with a CDN when traffic grows.
- **Azure credit is finite** (~12 months): if it runs low, move the worker to your
  own laptop (`pnpm dev:worker` against the same cloud DB/Redis/storage) — free forever.
- **iOS Safari:** native-HLS path won't carry tokens to segments → private playback
  there needs signed cookies (noted in Step 7).
