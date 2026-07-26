import { NextRequest } from "next/server";
import { Readable } from "node:stream";
import { getObjectRange } from "@vp/core/storage";

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
 * Read-through proxy for HLS artifacts in object storage. The player loads
 *   /api/stream/videos/<id>/hls/master.m3u8
 * and every relative reference inside the playlists (720p/index.m3u8,
 * seg_000.ts, …) resolves back through this same route — so one handler serves
 * the whole tree. Range requests are honored for seeking.
 *
 * NOTE: this is deliberately unauthenticated for the MVP. Signed URLs / access
 * checks come in Step 7 (privacy) + a CDN in Step 8.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { key: string[] } }
) {
  const key = params.key.map(decodeURIComponent).join("/");

  // Guard against path traversal out of the media prefix.
  if (key.includes("..") || !key.startsWith("videos/")) {
    return new Response("Not found", { status: 404 });
  }

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
    headers.set(
      "cache-control",
      ext === "m3u8" ? "no-cache" : "public, max-age=31536000, immutable"
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
