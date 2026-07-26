"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export type Track = { src: string; srclang: string; label: string; default: boolean };

type Props = {
  src: string; // master.m3u8 proxy URL
  poster?: string;
  tracks?: Track[];
};

type Level = { height: number; bitrate: number; index: number };

// hls.js-backed player. Falls back to native HLS (Safari) when MSE isn't used.
// Exposes a small quality selector driven by the master playlist's levels.
export default function Player({ src, poster, tracks = [] }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [current, setCurrent] = useState<number>(-1); // -1 = Auto
  const [error, setError] = useState<string | null>(null);

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

    const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
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
  }, [src]);

  function pickLevel(index: number) {
    setCurrent(index);
    if (hlsRef.current) hlsRef.current.currentLevel = index; // -1 → Auto
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-500/25 bg-black shadow-glow">
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
        <div className="flex flex-wrap items-center gap-2 border-t border-white/5 bg-ink-800 px-3 py-2.5">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
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
        <p className="border-t border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
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
          ? "bg-gradient-to-br from-brand-400 to-brand-600 text-white"
          : "bg-white/5 text-slate-300 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
