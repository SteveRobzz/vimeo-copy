# Transcode worker image for Railway.
# Build context is the REPO ROOT (see railway.json dockerfilePath), because the
# worker is a pnpm-workspace package that depends on @vp/core and @vp/db.
#
# Captions (Whisper) are intentionally NOT installed here — prod runs with
# ENABLE_CAPTIONS=false, keeping the image to Node + FFmpeg (slim, fast, cheap).
FROM node:20-bookworm-slim

# FFmpeg + ffprobe for probe/transcode; ca-certificates for TLS to the managed
# Postgres, Redis and R2 endpoints.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# pnpm via corepack, pinned to the repo's version.
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# The worker runs its TypeScript sources directly via tsx at runtime, and
# @vp/db's postinstall (prisma generate) needs the schema present, so we copy
# the whole workspace rather than manifests-only.
COPY . .

# Install ALL workspace deps. Do NOT set NODE_ENV=production before this: the
# worker's start command uses tsx, which is a devDependency.
RUN pnpm install --frozen-lockfile

# Runtime only — set after install so dev deps (tsx) are already present.
ENV NODE_ENV=production

# Starts the BullMQ consumer: tsx src/index.ts (see apps/worker/package.json).
CMD ["pnpm", "--filter", "@vp/worker", "start"]
