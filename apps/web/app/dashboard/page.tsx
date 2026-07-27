import Link from "next/link";
import { prisma } from "@vp/db";
import { getCurrentUser } from "@/lib/auth";
import { signStreamToken } from "@/lib/stream-token";
import LoopHeader from "@/components/loop-header";
import VideosPanel, { type DashVideo } from "./videos-panel";
import ViewsChart, { type SeriesPoint } from "./views-chart";
import { formatBytes, formatCompact, formatWatchTime } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const streamUrl = (key: string, videoId: string) =>
  `/api/stream/${key.split("/").map(encodeURIComponent).join("/")}?t=${signStreamToken(videoId)}`;

const DAYS = 30;

export default async function DashboardPage() {
  const user = await getCurrentUser();

  const [rows, watchAgg, recentViews] = await Promise.all([
    prisma.video.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        renditions: { select: { fileSizeBytes: true } },
        _count: { select: { renditions: true } },
      },
    }),
    prisma.view.aggregate({
      _sum: { watchedSeconds: true },
      where: { video: { ownerId: user.id } },
    }),
    prisma.view.findMany({
      where: { video: { ownerId: user.id }, createdAt: { gte: startOfDay(daysAgo(DAYS - 1)) } },
      select: { createdAt: true },
    }),
  ]);

  const videos: DashVideo[] = rows.map((v) => {
    const storageBytes = v.renditions.reduce((s, r) => s + Number(r.fileSizeBytes ?? 0n), 0);
    return {
      id: v.id,
      title: v.title,
      description: v.description ?? "",
      status: v.status,
      privacy: v.privacy,
      durationSeconds: v.durationSeconds,
      width: v.sourceWidth,
      height: v.sourceHeight,
      thumbnailUrl: v.thumbnailKey ? streamUrl(v.thumbnailKey, v.id) : null,
      viewCount: v.viewCount,
      renditionCount: v._count.renditions,
      storageBytes,
      createdAt: v.createdAt.toISOString(),
    };
  });

  const totalViews = videos.reduce((s, v) => s + v.viewCount, 0);
  const totalStorage = videos.reduce((s, v) => s + v.storageBytes, 0);
  const totalWatch = watchAgg._sum.watchedSeconds ?? 0;
  const ready = videos.filter((v) => v.status === "READY").length;
  const processing = videos.filter((v) =>
    ["QUEUED", "PROCESSING", "UPLOADING"].includes(v.status)
  ).length;

  const series = buildSeries(recentViews.map((r) => r.createdAt));

  return (
    <div className="flex min-h-screen flex-col">
      <LoopHeader userLabel={user.name ?? user.email} />

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Creator Studio</h1>
            <p className="mt-1 text-sm text-ink3">Your library, analytics, and video settings.</p>
          </div>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-[9px] bg-accent px-4 py-2 text-sm font-bold text-white transition hover:bg-accent-hover"
          >
            + Upload video
          </Link>
        </div>

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Total views" value={formatCompact(totalViews)} sub={`across ${videos.length} videos`} />
          <StatTile label="Watch time" value={formatWatchTime(totalWatch)} sub="all-time" />
          <StatTile label="Videos" value={String(videos.length)} sub={`${ready} ready · ${processing} processing`} />
          <StatTile label="Storage used" value={formatBytes(totalStorage)} sub="renditions + segments" />
        </div>

        {/* Chart */}
        <div className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-bold">Views · last 30 days</h2>
            <span className="text-xs text-ink3">{formatCompact(series.reduce((s, p) => s + p.views, 0))} total</span>
          </div>
          <ViewsChart data={series} />
        </div>

        {/* Videos */}
        <div className="mt-6">
          <VideosPanel videos={videos} />
        </div>
      </main>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink3">{label}</p>
      <p className="mt-2 text-[26px] font-extrabold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-ink3">{sub}</p>
    </div>
  );
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function buildSeries(dates: Date[]): SeriesPoint[] {
  const counts = new Map<string, number>();
  for (const d of dates) {
    const k = dayKey(new Date(d));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out: SeriesPoint[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = startOfDay(daysAgo(i));
    out.push({
      date: d.toISOString(),
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      views: counts.get(dayKey(d)) ?? 0,
    });
  }
  return out;
}
