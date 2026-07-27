import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless, signed stream-access tokens. A token grants time-limited read
// access to ONE video's artifacts (videos/<id>/*). The watch page mints one
// after it has checked the viewer may watch; the stream proxy verifies it with
// no DB round-trip. This is our "signed URL" — the same idea as a CDN signed
// cookie/URL, self-hosted until Step 8 puts a real CDN in front.

const SECRET =
  process.env.STREAM_SIGNING_SECRET || "dev-insecure-stream-secret-change-me";

if (!process.env.STREAM_SIGNING_SECRET && process.env.NODE_ENV === "production") {
  // Never ship prod without a real secret — tokens would be forgeable.
  console.warn(
    "[stream-token] STREAM_SIGNING_SECRET is not set — using an insecure default."
  );
}

const DEFAULT_TTL = 6 * 60 * 60; // 6 hours — long enough to watch, short enough to expire

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("base64url");
}

/** Mint a token authorizing reads of `videos/<videoId>/*` for `ttlSeconds`. */
export function signStreamToken(videoId: string, ttlSeconds = DEFAULT_TTL): string {
  const payload = { v: videoId, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Verify a token; returns its videoId if valid + unexpired, else null. */
export function verifyStreamToken(
  token: string | null | undefined
): { videoId: string } | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  // Constant-time signature comparison.
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof payload.v !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { videoId: payload.v };
  } catch {
    return null;
  }
}
