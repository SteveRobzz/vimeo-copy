// End-to-end check of the Step 3 pipeline WITHOUT a browser:
//   create -> sign-part -> PUT chunk to MinIO -> complete -> job enqueued.
// Server-side fetch bypasses CORS, so this validates storage + queue wiring.
// Run:  node scripts/test-upload.mjs
const BASE = process.env.BASE ?? "http://localhost:3000";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${text}`);
  return JSON.parse(text);
}

const filename = `test-${Date.now()}.mp4`;

console.log("1) create multipart upload…");
const { videoId, key, uploadId } = await post("/api/uploads/create", {
  filename,
  contentType: "video/mp4",
  title: "pipeline test",
});
console.log("   videoId:", videoId, "\n   key:", key);

console.log("2) sign part 1…");
const { url } = await post("/api/uploads/sign-part", { key, uploadId, partNumber: 1 });

console.log("3) PUT ~1MB chunk straight to storage…");
const chunk = Buffer.alloc(1024 * 1024, 7); // 1 MiB of bytes
const put = await fetch(url, { method: "PUT", body: chunk });
if (!put.ok) throw new Error(`PUT failed: ${put.status} ${await put.text()}`);
const etag = put.headers.get("etag");
console.log("   ETag:", etag);

console.log("4) complete upload (enqueues transcode job)…");
const done = await post("/api/uploads/complete", {
  videoId,
  key,
  uploadId,
  parts: [{ PartNumber: 1, ETag: etag }],
});
console.log("   ->", done);

console.log("\n✅ pipeline OK. Video", videoId, "is now", done.status);
console.log("   Verify job in Redis / row in DB with the commands printed by the runner.");
