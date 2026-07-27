import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@vp/db";
import { getCurrentUser } from "@/lib/auth";
import { signStreamToken } from "@/lib/stream-token";
import { avatarColors, initialOf, stripeBg } from "@/lib/loop";
import { formatCompact, formatDuration, formatRelativeTime } from "@/lib/format";
import LoopHeader from "@/components/loop-header";
import CopyLinkButton from "@/components/copy-link-button";
import Player, { type Track } from "./player";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const streamUrl = (key: string, videoId: string, token: string) =>
  `/api/stream/${key.split("/").map(encodeURIComponent).join("/")}?t=${token ?? signStreamToken(videoId)}`;

export default async function WatchPage({ params }: { params: { id: string } }) {
  const [video, user] = await Promise.all([
    prisma.video.findUnique({
      where: { id: params.id },
      include: {
        renditions: { orderBy: { height: "desc" } },
        captions: true,
        owner: { select: { id: true, name: true, email: true } },
      },
    }),
    getCurrentUser(),
  ]);

  if (!video) notFound();
  const isOwner = user.id === video.ownerId;
  if (video.privacy === "PRIVATE" && !isOwner) notFound();

  const token = signStreamToken(video.id);
  const isReady = video.status === "READY" && video.hlsMasterKey;
  const channel = video.owner.name ?? video.owner.email;
  const av = avatarColors(channel);

  // "Up next": other ready videos the viewer can see.
  const suggestionRows = await prisma.video.findMany({
    where: {
      status: "READY",
      id: { not: video.id },
      OR: [{ privacy: "PUBLIC" }, { ownerId: user.id }],
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { owner: { select: { name: true, email: true } } },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <LoopHeader userLabel={user.name ?? user.email} />

      <main className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 items-start gap-8 px-4 py-7 sm:px-8 lg:grid-cols-[1fr_360px]">
        {/* Left column */}
        <div className="min-w-0">
          {isReady ? (
            <Player
              videoId={video.id}
              token={token}
              src={streamUrl(video.hlsMasterKey!, video.id, token)}
              poster={video.thumbnailKey ? streamUrl(video.thumbnailKey, video.id, token) : undefined}
              tracks={video.captions.map<Track>((c) => ({
                src: streamUrl(c.objectKey, video.id, token),
                srclang: c.language,
                label: c.label,
                default: c.isDefault,
              }))}
            />
          ) : (
            <NotReady status={video.status} message={video.errorMessage} />
          )}

          <h1 className="mb-2.5 mt-5 text-[21px] font-extrabold tracking-tight">
            {video.title}
          </h1>

          {/* Channel + actions */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex min-w-[220px] flex-1 items-center gap-2.5">
              <span
                className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-[13px] font-bold"
                style={{ background: av.bg, color: av.fg }}
              >
                {initialOf(channel)}
              </span>
              <div>
                <div className="text-[14.5px] font-bold">{channel}</div>
                <div className="text-[12.5px] text-ink3">Creator</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOwner && <PrivacyPill privacy={video.privacy} />}
              <CopyLinkButton />
            </div>
          </div>

          {/* Description */}
          <div className="mt-4 rounded-[10px] bg-panel px-4 py-3.5 text-[13.5px] leading-[1.6] text-ink2">
            <div className="mb-1 font-bold text-ink">
              {formatCompact(video.viewCount)} views · {formatRelativeTime(video.createdAt.toISOString())}
            </div>
            {video.description || "No description provided."}
          </div>

          {/* Renditions + captions */}
          {(video.renditions.length > 0 || video.captions.length > 0) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink3">
                Renditions
              </span>
              {video.renditions.map((r) => (
                <span
                  key={r.label}
                  className="rounded-md border border-line2 bg-panel px-2 py-1 text-[11px] font-bold text-ink2"
                >
                  {r.label}
                </span>
              ))}
              {video.captions.map((c) => (
                <span
                  key={c.id}
                  className="rounded-md border border-accent/30 bg-accent-soft px-2 py-1 text-[11px] font-bold text-[oklch(0.3_0.08_264)]"
                >
                  CC {c.language}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Up next */}
        <aside>
          <div className="mb-3.5 text-sm font-bold">Up next</div>
          <div className="flex flex-col gap-3.5">
            {suggestionRows.map((s) => {
              const t = signStreamToken(s.id);
              const thumb = s.thumbnailKey ? streamUrl(s.thumbnailKey, s.id, t) : null;
              return (
                <Link key={s.id} href={`/watch/${s.id}`} className="group flex gap-2.5">
                  <div
                    className="relative aspect-video w-[150px] flex-shrink-0 overflow-hidden rounded-[9px]"
                    style={{ background: thumb ? "#111" : stripeBg(s.id) }}
                  >
                    {thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    )}
                    {s.durationSeconds ? (
                      <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-px font-mono text-[10px] font-semibold text-white">
                        {formatDuration(s.durationSeconds)}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="clamp-2 text-[13px] font-bold leading-[1.35] group-hover:text-accent">
                      {s.title}
                    </div>
                    <div className="mt-1 truncate text-[11.5px] text-ink3">
                      {s.owner.name ?? s.owner.email}
                    </div>
                    <div className="text-[11.5px] text-ink3">{formatCompact(s.viewCount)} views</div>
                  </div>
                </Link>
              );
            })}
            {suggestionRows.length === 0 && (
              <p className="text-[13px] text-ink3">Nothing else to watch yet.</p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

function PrivacyPill({ privacy }: { privacy: "PUBLIC" | "UNLISTED" | "PRIVATE" }) {
  const map = {
    PUBLIC: { t: "Public", i: "🌐" },
    UNLISTED: { t: "Unlisted", i: "🔗" },
    PRIVATE: { t: "Private", i: "🔒" },
  }[privacy];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[9px] border border-line2 bg-white px-3 py-[9px] text-[13px] font-semibold text-ink2">
      <span className="text-[11px]">{map.i}</span>
      {map.t}
    </span>
  );
}

function NotReady({ status, message }: { status: string; message: string | null }) {
  const isError = status === "ERROR";
  return (
    <div
      className={`grid aspect-video w-full place-items-center rounded-[14px] border ${
        isError ? "border-danger/30 bg-[oklch(0.97_0.03_25)]" : "border-line bg-panel"
      }`}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        {!isError && (
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-line2 border-t-accent" />
        )}
        <p className="text-sm font-bold text-ink">
          {isError ? "Transcode failed" : `Video is ${status.toLowerCase()}…`}
        </p>
        <p className="max-w-sm text-xs text-ink3">
          {isError
            ? message ?? "Something went wrong during processing."
            : "The transcode pipeline is still preparing this video. Reload to refresh."}
        </p>
      </div>
    </div>
  );
}
