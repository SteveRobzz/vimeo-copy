import { prisma } from "@vp/db";
import { getCurrentUser } from "@/lib/auth";
import { signStreamToken } from "@/lib/stream-token";
import { avatarColors, initialOf } from "@/lib/loop";
import { formatCompact, formatDuration, formatRelativeTime } from "@/lib/format";
import LoopHeader from "@/components/loop-header";
import VideoCard, { type CardVideo } from "@/components/video-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const streamUrl = (key: string, videoId: string) =>
  `/api/stream/${key.split("/").map(encodeURIComponent).join("/")}?t=${signStreamToken(videoId)}`;

export default async function ProfilePage() {
  const user = await getCurrentUser();
  const name = user.name ?? user.email;
  const av = avatarColors(name);

  const rows = await prisma.video.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const totalViews = rows.reduce((s, v) => s + v.viewCount, 0);
  const cards: CardVideo[] = rows.map((v) => ({
    href: `/watch/${v.id}`,
    title: v.title,
    channel: name,
    thumbnailUrl: v.thumbnailKey ? streamUrl(v.thumbnailKey, v.id) : null,
    durationLabel: v.durationSeconds ? formatDuration(v.durationSeconds) : undefined,
    viewsLabel: `${formatCompact(v.viewCount)} views`,
    timeAgo: formatRelativeTime(v.createdAt.toISOString()),
    seed: v.id,
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <LoopHeader userLabel={name} />

      <main className="mx-auto w-full max-w-[1000px] flex-1 px-4 py-9 sm:px-8">
        <div className="mb-8 flex items-center gap-5">
          <span
            className="flex h-[84px] w-[84px] flex-shrink-0 items-center justify-center rounded-full text-[28px] font-bold"
            style={{ background: av.bg, color: av.fg }}
          >
            {initialOf(name)}
          </span>
          <div>
            <div className="text-[22px] font-extrabold">{name}</div>
            <div className="mt-1 text-[13.5px] text-ink3">
              {rows.length} {rows.length === 1 ? "video" : "videos"} · {formatCompact(totalViews)} total views
            </div>
          </div>
        </div>

        <div className="mb-4 text-[15px] font-bold">My videos</div>
        {cards.length > 0 ? (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {cards.map((c) => (
              <VideoCard key={c.href} v={c} compact />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-[14.5px] text-ink3">
            No uploads yet.{" "}
            <a href="/upload" className="font-bold text-accent">
              Upload one now.
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
