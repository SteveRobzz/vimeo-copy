import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@vp/db";
import Player, { type Track } from "./player";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const streamUrl = (key: string) =>
  `/api/stream/${key.split("/").map(encodeURIComponent).join("/")}`;

function fmtDuration(s: number | null): string {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default async function WatchPage({ params }: { params: { id: string } }) {
  const video = await prisma.video.findUnique({
    where: { id: params.id },
    include: {
      renditions: { orderBy: { height: "desc" } },
      captions: true,
      owner: { select: { name: true, email: true } },
    },
  });

  if (!video) notFound();

  const isReady = video.status === "READY" && video.hlsMasterKey;

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink text-brand-50">
      {/* Aurora background (matches the upload page) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink-800 to-[#081334]" />
        <div className="absolute -left-24 top-[-10%] h-[26rem] w-[26rem] rounded-full bg-brand-700/35 blur-[120px] animate-blob" />
        <div className="absolute right-[-8%] top-[25%] h-[24rem] w-[24rem] rounded-full bg-brand-500/25 blur-[120px] animate-blob-slow" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-10">
        <Link
          href="/upload"
          className="w-fit text-xs font-medium text-brand-300 transition hover:text-brand-100"
        >
          ← Upload another
        </Link>

        {isReady ? (
          <Player
            src={streamUrl(video.hlsMasterKey!)}
            poster={video.thumbnailKey ? streamUrl(video.thumbnailKey) : undefined}
            tracks={video.captions.map<Track>((c) => ({
              src: streamUrl(c.objectKey),
              srclang: c.language,
              label: c.label,
              default: c.isDefault,
            }))}
          />
        ) : (
          <NotReady status={video.status} message={video.errorMessage} />
        )}

        {/* Title + metadata */}
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight text-brand-50">
            {video.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <span>{video.owner.name ?? video.owner.email}</span>
            {video.durationSeconds != null && (
              <>
                <span className="text-slate-600">·</span>
                <span>{fmtDuration(video.durationSeconds)}</span>
              </>
            )}
            {video.sourceWidth && video.sourceHeight && (
              <>
                <span className="text-slate-600">·</span>
                <span>
                  {video.sourceWidth}×{video.sourceHeight} source
                </span>
              </>
            )}
          </div>

          {video.description && (
            <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
              {video.description}
            </p>
          )}

          {video.renditions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Renditions
              </span>
              {video.renditions.map((r) => (
                <span
                  key={r.label}
                  className="rounded-md border border-brand-400/40 bg-brand-500/15 px-2 py-1 text-[11px] font-semibold text-brand-100"
                >
                  {r.label}
                </span>
              ))}
              {video.captions.map((c) => (
                <span
                  key={c.id}
                  className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[11px] font-semibold text-emerald-200"
                >
                  CC {c.language}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function NotReady({
  status,
  message,
}: {
  status: string;
  message: string | null;
}) {
  const isError = status === "ERROR";
  return (
    <div
      className={`grid aspect-video w-full place-items-center rounded-2xl border ${
        isError
          ? "border-rose-500/30 bg-rose-500/[0.06]"
          : "border-brand-500/25 bg-white/[0.03]"
      }`}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        {!isError && (
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-400" />
        )}
        <p className="text-sm font-medium text-brand-100">
          {isError ? "Transcode failed" : `Video is ${status.toLowerCase()}…`}
        </p>
        <p className="max-w-sm text-xs text-slate-400">
          {isError
            ? message ?? "Something went wrong during processing."
            : "The transcode pipeline is still preparing this video. This page refreshes on reload."}
        </p>
      </div>
    </div>
  );
}
