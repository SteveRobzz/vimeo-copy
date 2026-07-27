import Link from "next/link";
import { avatarColors, initialOf, stripeBg } from "@/lib/loop";

export type CardVideo = {
  href: string;
  title: string;
  channel: string;
  thumbnailUrl: string | null;
  durationLabel?: string;
  viewsLabel?: string;
  timeAgo?: string;
  seed: string; // stable seed for placeholder + avatar hue
};

// Loop home/profile grid card: thumbnail + channel avatar + meta.
export default function VideoCard({ v, compact = false }: { v: CardVideo; compact?: boolean }) {
  const av = avatarColors(v.channel || v.seed);
  return (
    <Link href={v.href} className="group block">
      <div
        className="relative aspect-video w-full overflow-hidden rounded-xl"
        style={{ background: v.thumbnailUrl ? "#111" : stripeBg(v.seed) }}
      >
        {v.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={v.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        )}
        {v.durationLabel && (
          <span className="absolute bottom-2 right-2 rounded-[5px] bg-black/70 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">
            {v.durationLabel}
          </span>
        )}
      </div>

      <div className={`mt-3 flex gap-2.5 ${compact ? "" : ""}`}>
        {!compact && (
          <span
            className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: av.bg, color: av.fg }}
          >
            {initialOf(v.channel || v.seed)}
          </span>
        )}
        <div className="min-w-0">
          <div className="clamp-2 text-[14.5px] font-bold leading-[1.35] group-hover:text-accent">
            {v.title}
          </div>
          <div className="mt-1 truncate text-[12.5px] text-ink3">{v.channel}</div>
          {(v.viewsLabel || v.timeAgo) && (
            <div className="text-[12.5px] text-ink3">
              {[v.viewsLabel, v.timeAgo].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
