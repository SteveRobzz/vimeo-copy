import { prisma } from "@vp/db";
import { getCurrentUser } from "@/lib/auth";
import { signStreamToken } from "@/lib/stream-token";
import LoopHeader from "@/components/loop-header";
import VideoCard, { type CardVideo } from "@/components/video-card";
import { formatCompact, formatDuration, formatRelativeTime } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const streamUrl = (key: string, videoId: string) =>
  `/api/stream/${key.split("/").map(encodeURIComponent).join("/")}?t=${signStreamToken(videoId)}`;

export default async function HomePage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const user = await getCurrentUser();
  const q = (searchParams.q ?? "").trim().toLowerCase();

  // The feed = ready videos that are public OR owned by the viewer.
  const rows = await prisma.video.findMany({
    where: {
      status: "READY",
      OR: [{ privacy: "PUBLIC" }, { ownerId: user.id }],
    },
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { name: true, email: true } } },
  });

  const videos: CardVideo[] = rows
    .map((v) => {
      const channel = v.owner.name ?? v.owner.email;
      return {
        id: v.id,
        channel,
        card: {
          href: `/watch/${v.id}`,
          title: v.title,
          channel,
          thumbnailUrl: v.thumbnailKey ? streamUrl(v.thumbnailKey, v.id) : null,
          durationLabel: v.durationSeconds ? formatDuration(v.durationSeconds) : undefined,
          viewsLabel: `${formatCompact(v.viewCount)} views`,
          timeAgo: formatRelativeTime(v.createdAt.toISOString()),
          seed: v.id,
        } satisfies CardVideo,
      };
    })
    .filter((x) =>
      !q ? true : x.card.title.toLowerCase().includes(q) || x.channel.toLowerCase().includes(q)
    )
    .map((x) => x.card);

  return (
    <div className="flex min-h-screen flex-col">
      <LoopHeader userLabel={user.name ?? user.email} />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-8">
        {videos.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {videos.map((v) => (
              <VideoCard key={v.href} v={v} />
            ))}
          </div>
        ) : (
          <div className="grid place-items-center gap-3 py-24 text-center">
            <p className="text-[15px] text-ink3">
              {q ? "No videos match your search." : "No videos here yet."}
            </p>
            {!q && (
              <a
                href="/upload"
                className="rounded-[9px] bg-accent px-4 py-2 text-sm font-bold text-white transition hover:bg-accent-hover"
              >
                Upload a video
              </a>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
