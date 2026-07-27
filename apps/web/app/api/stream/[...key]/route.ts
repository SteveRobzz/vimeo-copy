import { NextRequest } from "next/server";
import { Readable } from "node:stream";
import { getObjectRange } from "@vp/core/storage";
import { prisma } from "@vp/db";
import { verifyStreamToken } from "@/lib/stream-token";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
// Bytes stream from storage on every request — never cache the route itself.
export const dynamic = "force-dynamic";

// Content types by extension, so browsers + hls.js treat playlists/segments right.
const CONTENT_TYPES: Record<string, string> = {
  m3u8: "application/vnd.apple.mpegurl",
  ts: "video/mp2t",
  vtt: "text/vtt",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  mp4: "video/mp4",
};

/**
 * Decide whether this request may read `videos/<videoId>/*`. In order of cost:
 *   1. A valid signed stream token for this video   → allow (no DB).
 *   2. The video is PUBLIC                            → allow (open assets).
 *   3. The signed-in user owns the video             → allow (dashboard/preview).
 * Everything else is denied. Playback always carries a token (step 1), so the
 * DB paths only run for the occasional token-less request (e.g. a thumbnail).
 */
async function authorize(
  req: NextRequest,
  videoId: string
): Promise<"ok" | "forbidden" | "not_found"> {
  const token = req.nextUrl.searchParams.get("t");
  const verified = verifyStreamToken(token);
  if (verified && verified.videoId === videoId) return "ok";

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { privacy: true, ownerId: true },
  });
  if (!video) return "not_found";
  if (video.privacy === "PUBLIC") return "ok";

  const user = await getCurrentUser();
  return user.id === video.ownerId ? "ok" : "forbidden";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { key: string[] } }
) {
  const key = params.key.map(decodeURIComponent).join("/");

  // Guard against path traversal out of the media prefix.
  if (key.includes("..") || !key.startsWith("videos/")) {
    return new Response("Not found", { status: 404 });
  }

  // Enforce privacy before touching storage. Key layout: videos/<id>/...
  const videoId = key.split("/")[1] ?? "";
  const decision = await authorize(req, videoId);
  if (decision === "not_found") return new Response("Not found", { status: 404 });
  if (decision === "forbidden") return new Response("Forbidden", { status: 403 });

  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const range = req.headers.get("range") ?? undefined;

  try {
    const obj = await getObjectRange(key, range);

    const headers = new Headers();
    headers.set("content-type", CONTENT_TYPES[ext] ?? obj.contentType ?? "application/octet-stream");
    headers.set("accept-ranges", "bytes");
    if (obj.contentLength != null) headers.set("content-length", String(obj.contentLength));
    if (obj.contentRange) headers.set("content-range", obj.contentRange);
    // Playlists change while processing; segments are immutable once written.
    // Private/token'd responses must stay out of shared caches.
    headers.set(
      "cache-control",
      ext === "m3u8" ? "no-cache, private" : "private, max-age=31536000, immutable"
    );

    // Node Readable → web ReadableStream for the Response body.
    const body = Readable.toWeb(obj.body) as ReadableStream;
    return new Response(body, { status: obj.status, headers });
  } catch (err: any) {
    const code = err?.$metadata?.httpStatusCode;
    if (code === 404 || err?.name === "NoSuchKey") {
      return new Response("Not found", { status: 404 });
    }
    return new Response("Upstream error", { status: 502 });
  }
}
