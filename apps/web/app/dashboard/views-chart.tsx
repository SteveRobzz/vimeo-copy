"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SeriesPoint = { date: string; label: string; views: number };

const H = 200;
const PAD = { top: 16, right: 16, bottom: 26, left: 32 };

// Single-series area chart of daily views. One brand hue (magnitude over time),
// no legend (the card title names it), recessive grid, crosshair + tooltip.
export default function ViewsChart({ data }: { data: SeriesPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { linePath, areaPath, points, maxY, yTicks, plotW, plotH } = useMemo(() => {
    const plotW = Math.max(1, width - PAD.left - PAD.right);
    const plotH = H - PAD.top - PAD.bottom;
    const maxRaw = Math.max(1, ...data.map((d) => d.views));
    // Round the top gridline up to a "nice" number.
    const step = niceStep(maxRaw);
    const maxY = Math.max(step, Math.ceil(maxRaw / step) * step);

    const x = (i: number) =>
      PAD.left + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const y = (v: number) => PAD.top + plotH - (v / maxY) * plotH;

    const points = data.map((d, i) => ({ x: x(i), y: y(d.views), ...d }));
    const linePath = points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
    const areaPath =
      `${linePath} L${points[points.length - 1]?.x ?? PAD.left},${PAD.top + plotH}` +
      ` L${points[0]?.x ?? PAD.left},${PAD.top + plotH} Z`;

    const ticks = 4;
    const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
      const v = (maxY / ticks) * i;
      return { v, y: y(v) };
    });

    return { linePath, areaPath, points, maxY, yTicks, plotW, plotH };
  }, [data, width]);

  const total = useMemo(() => data.reduce((s, d) => s + d.views, 0), [data]);

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const rel = Math.max(0, Math.min(1, (px - PAD.left) / plotW));
    setHover(Math.round(rel * (data.length - 1)));
  }

  const hp = hover != null ? points[hover] : null;

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg width={width} height={H} role="img" aria-label="Daily views over the last 30 days">
        <defs>
          <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3355cc" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#3355cc" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Recessive gridlines + y labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={t.y}
              y2={t.y}
              stroke="rgba(20,25,40,0.08)"
              strokeWidth={1}
            />
            <text x={PAD.left - 8} y={t.y + 3} textAnchor="end" className="fill-[oklch(0.55_0.015_250)]" fontSize={10}>
              {Math.round(t.v)}
            </text>
          </g>
        ))}

        {/* x labels — first, middle, last */}
        {[0, Math.floor(data.length / 2), data.length - 1].map((i) => (
          <text
            key={i}
            x={points[i]?.x}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
            className="fill-[oklch(0.55_0.015_250)]"
            fontSize={10}
          >
            {data[i]?.label}
          </text>
        ))}

        <path d={areaPath} fill="url(#viewsFill)" />
        <path d={linePath} fill="none" stroke="#3355cc" strokeWidth={2} strokeLinejoin="round" />

        {/* Hover crosshair + marker */}
        {hp && (
          <g>
            <line
              x1={hp.x}
              x2={hp.x}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="rgba(51,85,204,0.4)"
              strokeWidth={1}
            />
            <circle cx={hp.x} cy={hp.y} r={4} fill="#3355cc" stroke="#fff" strokeWidth={2} />
          </g>
        )}

        {/* Interaction surface */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={plotW}
          height={plotH}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>

      {hp && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-white px-2.5 py-1.5 text-center shadow-pop"
          style={{ left: hp.x, top: Math.max(0, hp.y - 52) }}
        >
          <div className="text-sm font-bold text-ink">{hp.views}</div>
          <div className="text-[10px] text-ink3">{hp.label}</div>
        </div>
      )}

      {total === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="rounded-full border border-line bg-panel px-3 py-1 text-xs text-ink3">
            No views yet — share a video to see traffic here
          </span>
        </div>
      )}
    </div>
  );
}

// Choose a gridline step so the axis tops out at a clean number.
function niceStep(max: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1, max))));
  const norm = max / pow;
  const mult = norm <= 1 ? 0.25 : norm <= 2 ? 0.5 : norm <= 5 ? 1 : 2;
  return Math.max(1, mult * pow);
}
