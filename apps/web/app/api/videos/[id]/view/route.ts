import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@vp/db";

export const runtime = "nodejs";

// Hash the IP so we can dedup views without ever storing a raw address.
function hashIp(req: NextRequest): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return createHash("sha256").update(`vp-view:${ip}`).digest("hex").slice(0, 32);
}

const DEDUP_WINDOW_MS = 30 * 60 * 1000; // one view per viewer per 30 min

/**
 * Records playback analytics for a video. Two shapes:
 *   - {}                              → a new view (deduped by ip+window)
 *   - { viewId, watchedSeconds }      → update watch time (pagehide beacon)
 * Beacons are best-effort; failures never surface to the viewer.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));

  // Beacon update path: extend an existing view's watch time.
  if (body?.viewId && typeof body.watchedSeconds === "number") {
    await prisma.view
      .update({
        where: { id: String(body.viewId) },
        data: { watchedSeconds: Math.max(0, Math.round(body.watchedSeconds)) },
      })
      .catch(() => {});
    return NextResponse.json({ ok: true });
  }

  const video = await prisma.video.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!video) return NextResponse.json({ error: "not found" }, { status: 404 });

  const ipHash = hashIp(req);

  // Dedup: same viewer + video within the window counts once.
  const recent = await prisma.view.findFirst({
    where: {
      videoId: video.id,
      ipHash,
      createdAt: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (recent) return NextResponse.json({ viewId: recent.id, deduped: true });

  const [view] = await prisma.$transaction([
    prisma.view.create({
      data: { videoId: video.id, ipHash, watchedSeconds: 0 },
      select: { id: true },
    }),
    prisma.video.update({
      where: { id: video.id },
      data: { viewCount: { increment: 1 } },
    }),
  ]);

  return NextResponse.json({ viewId: view.id });
}
