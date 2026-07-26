export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Video Platform</h1>
        <p className="mt-2 text-neutral-400">
          Upload → transcode (FFmpeg) → adaptive HLS playback. MVP scaffold.
        </p>
      </div>

      <ol className="space-y-2 text-sm text-neutral-300">
        <li>✅ Step 2 — Monorepo + Prisma schema + Next.js scaffold</li>
        <li className="text-neutral-500">⬜ Step 3 — Resumable upload → object storage → enqueue transcode</li>
        <li className="text-neutral-500">⬜ Step 4 — FFmpeg worker: probe → ladder → HLS → captions</li>
        <li className="text-neutral-500">⬜ Step 5 — hls.js player page</li>
        <li className="text-neutral-500">⬜ Step 6 — Creator dashboard</li>
        <li className="text-neutral-500">⬜ Step 7 — Privacy controls + signed URLs</li>
        <li className="text-neutral-500">⬜ Step 8 — Deploy (Vercel + Railway + R2)</li>
      </ol>

      <p className="text-xs text-neutral-600">
        Health check: <code className="text-neutral-400">/api/health</code>
      </p>
    </main>
  );
}
