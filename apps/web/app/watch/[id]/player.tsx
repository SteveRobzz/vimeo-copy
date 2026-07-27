"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export type Track = { src: string; srclang: string; label: string; default: boolean };

type Props = {
  videoId: string;
  token: string; // signed stream token; appended to every playlist/segment request
  src: string; // master.m3u8 proxy URL (already tokenized)
  poster?: string;
  tracks?: Track[];
};

type Level = { height: number; bitrate: number; index: number };

// hls.js-backed player. Falls back to native HLS (Safari) when MSE isn't used.
// Exposes a small quality selector driven by the master playlist's levels.
export default function Player({ videoId, token, src, poster, tracks = [] }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [current, setCurrent] = useState<number>(-1); // -1 = Auto
  const [error, setError] = useState<string | null>(null);

  // Analytics: register a view on first play, then beacon watch time on exit.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let viewId: string | null = null;
    let counted = false;

    const onPlay = async () => {
      if (counted) return;
      counted = true;
      try {
        const res = await fetch(`/api/videos/${videoId}/view`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        viewId = (await res.json())?.viewId ?? null;
      } catch {
        /* analytics is best-effort */
      }
    };

    const flush = () => {
      if (!viewId) return;
      const payload = JSON.stringify({
        viewId,
        watchedSeconds: video.currentTime,
      });
      navigator.sendBeacon?.(`/api/videos/${videoId}/view`, payload);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", flush);
    video.addEventListener("ended", flush);
    window.addEventListener("pagehide", flush);

    return () => {
      flush();
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", flush);
      video.removeEventListener("ended", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [videoId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Safari / iOS play HLS natively — no hls.js needed.
    if (!Hls.isSupported()) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
      } else {
        setError("This browser can't play HLS.");
      }
      return;
    }

    // Custom loader that appends the signed token to every request hls.js makes
    // (variant playlists + segments), since URL resolution drops the query from
    // the master URL when following relative references.
    const BaseLoader = Hls.DefaultConfig.loader as any;
    class TokenLoader extends BaseLoader {
      load(context: any, config: any, callbacks: any) {
        if (context?.url) {
          const u = new URL(context.url, location.origin);
          if (!u.searchParams.has("t")) u.searchParams.set("t", token);
          context.url = u.toString();
        }
        super.load(context, config, callbacks);
      }
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      loader: TokenLoader as unknown as typeof Hls.DefaultConfig.loader,
    });
    hlsRef.current = hls;
    hls.loadSource(src);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
      setLevels(
        data.levels
          .map((l, index) => ({ height: l.height, bitrate: l.bitrate, index }))
          .sort((a, b) => b.height - a.height)
      );
    });
    hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
      // Reflect the active level only while in Auto so the badge stays truthful.
      if (hls.autoLevelEnabled) setCurrent(-1);
    });
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.fatal) setError(`Playback error: ${data.details}`);
    });

    return () => {
      hls.destroy();
      hlsRef.current = null;
    };
  }, [src, token]);

  function pickLevel(index: number) {
    setCurrent(index);
    if (hlsRef.current) hlsRef.current.currentLevel = index; // -1 → Auto
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-black shadow-card">
      <video
        ref={videoRef}
        poster={poster}
        controls
        playsInline
        className="aspect-video w-full bg-black"
        crossOrigin="anonymous"
      >
        {tracks.map((t) => (
          <track
            key={t.srclang}
            kind="subtitles"
            src={t.src}
            srcLang={t.srclang}
            label={t.label}
            default={t.default}
          />
        ))}
      </video>

      {/* Quality selector */}
      {levels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-panel px-3 py-2.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-ink3">
            Quality
          </span>
          <QualityBtn active={current === -1} onClick={() => pickLevel(-1)}>
            Auto
          </QualityBtn>
          {levels.map((l) => (
            <QualityBtn
              key={l.index}
              active={current === l.index}
              onClick={() => pickLevel(l.index)}
            >
              {l.height}p
            </QualityBtn>
          ))}
        </div>
      )}

      {error && (
        <p className="border-t border-danger/20 bg-[oklch(0.97_0.03_25)] px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function QualityBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
        active
          ? "bg-accent text-white"
          : "border border-line2 bg-white text-ink2 hover:bg-panel"
      }`}
    >
      {children}
    </button>
  );
}
