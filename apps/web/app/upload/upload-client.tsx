"use client";

import { useEffect, useRef, useState } from "react";
import Uppy, { type UppyFile } from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import AwsS3 from "@uppy/aws-s3";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

type Status = "QUEUED" | "PROCESSING" | "READY" | "ERROR" | "UPLOADING";
type Privacy = "PUBLIC" | "UNLISTED" | "PRIVATE";

type VideoStatus = {
  id: string;
  title: string;
  status: Status;
  errorMessage: string | null;
  durationSeconds: number | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  thumbnailKey: string | null;
  renditions: { label: string; height: number; bitrateKbps: number }[];
};

const VISIBILITY: { value: Privacy; label: string; icon: string; desc: string }[] = [
  { value: "PUBLIC", label: "Public", icon: "🌐", desc: "Anyone can find and watch." },
  { value: "UNLISTED", label: "Unlisted", icon: "🔗", desc: "Only people with the link." },
  { value: "PRIVATE", label: "Private", icon: "🔒", desc: "Only you can watch." },
];

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return res.json();
}

const TERMINAL: Status[] = ["READY", "ERROR"];

export default function UploadClient() {
  const mountRef = useRef<HTMLDivElement>(null);
  const uppyRef = useRef<Uppy | null>(null);
  const [videos, setVideos] = useState<Record<string, VideoStatus>>({});
  const order = useRef<string[]>([]);

  const [privacy, setPrivacy] = useState<Privacy>("PUBLIC");
  const privacyRef = useRef<Privacy>(privacy);
  useEffect(() => {
    privacyRef.current = privacy;
  }, [privacy]);

  useEffect(() => {
    if (uppyRef.current || !mountRef.current) return;

    const u = new Uppy({
      autoProceed: false,
      restrictions: { maxNumberOfFiles: 5, allowedFileTypes: ["video/*"] },
    });

    u.use(AwsS3, {
      shouldUseMultipart: true,
      async createMultipartUpload(file: UppyFile<any, any>) {
        const { videoId, key, uploadId } = await postJson("/api/uploads/create", {
          filename: file.name,
          contentType: file.type,
          title: file.name,
          privacy: privacyRef.current,
        });
        u.setFileMeta(file.id, { videoId });
        return { uploadId, key };
      },
      async signPart(_file, { uploadId, key, partNumber }) {
        const { url } = await postJson("/api/uploads/sign-part", { uploadId, key, partNumber });
        return { url };
      },
      async listParts(_file, { uploadId, key }) {
        const { parts } = await postJson("/api/uploads/list-parts", { uploadId, key });
        return parts;
      },
      async completeMultipartUpload(file, { uploadId, key, parts }) {
        await postJson("/api/uploads/complete", { videoId: file.meta.videoId, uploadId, key, parts });
        return {};
      },
      async abortMultipartUpload(file, { uploadId, key }) {
        await postJson("/api/uploads/abort", { videoId: file.meta.videoId, uploadId, key });
      },
    });

    u.use(Dashboard, {
      target: mountRef.current,
      inline: true,
      height: 320,
      proudlyDisplayPoweredByUppy: false,
      note: "Video files only — chunked, resumable upload straight to storage.",
    });

    u.on("complete", (result) => {
      for (const f of result.successful ?? []) {
        const id = String(f.meta.videoId ?? "");
        if (!id) continue;
        if (!order.current.includes(id)) order.current.push(id);
        setVideos((prev) => ({
          ...prev,
          [id]: {
            id,
            title: f.name ?? "video",
            status: "QUEUED",
            errorMessage: null,
            durationSeconds: null,
            sourceWidth: null,
            sourceHeight: null,
            thumbnailKey: null,
            renditions: [],
          },
        }));
      }
    });

    uppyRef.current = u;
    return () => {
      u.destroy();
      uppyRef.current = null;
    };
  }, []);

  useEffect(() => {
    const iv = setInterval(async () => {
      const active = Object.values(videos).filter((v) => !TERMINAL.includes(v.status));
      if (active.length === 0) return;
      await Promise.all(
        active.map(async (v) => {
          try {
            const res = await fetch(`/api/videos/${v.id}/status`, { cache: "no-store" });
            if (!res.ok) return;
            const data: VideoStatus = await res.json();
            setVideos((prev) => ({ ...prev, [v.id]: { ...prev[v.id], ...data } }));
          } catch {
            /* transient */
          }
        })
      );
    }, 2500);
    return () => clearInterval(iv);
  }, [videos]);

  const tracked = order.current.map((id) => videos[id]).filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-12 sm:px-8">
      <h1 className="text-2xl font-extrabold tracking-tight">Upload a video</h1>
      <p className="mt-1.5 text-sm text-ink3">
        Bytes stream straight to storage in resumable chunks. On completion a transcode job
        (FFmpeg → HLS → captions) runs automatically.
      </p>

      {/* Visibility */}
      <div className="mt-6 rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-bold">Visibility</span>
          <span className="text-[11px] text-ink3">Change anytime in Studio</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {VISIBILITY.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setPrivacy(o.value)}
              aria-pressed={privacy === o.value}
              className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition ${
                privacy === o.value
                  ? "border-accent bg-accent-soft/40"
                  : "border-line2 bg-panel2 hover:border-ink3"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <span aria-hidden>{o.icon}</span> {o.label}
              </span>
              <span className="text-[11px] leading-snug text-ink3">{o.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Uploader */}
      <div className="vp-uppy mt-5">
        <div ref={mountRef} />
      </div>

      {/* Live pipeline */}
      {tracked.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold">Transcode pipeline</h2>
          <div className="flex flex-col gap-3">
            {tracked.map((v) => (
              <PipelineCard key={v.id} v={v} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---- Live status card ---- */

const STEPS: { key: Status; label: string }[] = [
  { key: "QUEUED", label: "Queued" },
  { key: "PROCESSING", label: "Transcoding" },
  { key: "READY", label: "Ready" },
];

function stepIndex(status: Status): number {
  if (status === "QUEUED") return 0;
  if (status === "PROCESSING") return 1;
  if (status === "READY") return 2;
  return 0;
}

function PipelineCard({ v }: { v: VideoStatus }) {
  const isError = v.status === "ERROR";
  const isReady = v.status === "READY";
  const active = stepIndex(v.status);

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white p-4 shadow-card ${
        isError ? "border-danger/40" : isReady ? "border-accent/50" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{v.title}</p>
          <code className="font-mono text-[11px] text-ink3">{v.id}</code>
        </div>
        <StatusBadge status={v.status} />
      </div>

      {!isError && (
        <div className="mt-4 flex items-center gap-2">
          {STEPS.map((s, i) => {
            const reached = i <= active;
            const current = i === active && !isReady;
            return (
              <div key={s.key} className="flex flex-1 items-center gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${
                      reached ? "bg-accent text-white" : "bg-panel text-ink3"
                    } ${current ? "animate-pulse" : ""}`}
                  >
                    {i < active || isReady ? "✓" : i + 1}
                  </span>
                  <span className={`text-xs ${reached ? "text-ink" : "text-ink3"}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="h-px flex-1 bg-line">
                    <div className={`h-px bg-accent transition-all duration-500 ${i < active ? "w-full" : "w-0"}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {v.status === "PROCESSING" && (
        <div className="vp-shimmer mt-4 h-1.5 w-full rounded-full bg-panel" />
      )}

      {isError && v.errorMessage && (
        <p className="mt-3 rounded-lg bg-[oklch(0.97_0.03_25)] px-3 py-2 text-xs text-danger">
          {v.errorMessage}
        </p>
      )}

      {isReady && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {v.durationSeconds != null && <Meta label={fmtDuration(v.durationSeconds)} />}
          {v.sourceWidth && v.sourceHeight && <Meta label={`${v.sourceWidth}×${v.sourceHeight}`} />}
          {v.renditions.map((r) => (
            <span
              key={r.label}
              className="rounded-md border border-line2 bg-panel px-2 py-1 text-[11px] font-bold text-ink2"
            >
              {r.label}
            </span>
          ))}
          <a
            href={`/watch/${v.id}`}
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-white transition hover:bg-accent-hover"
          >
            Watch →
          </a>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { text: string; cls: string }> = {
    UPLOADING: { text: "Uploading", cls: "bg-panel text-ink2" },
    QUEUED: { text: "Queued", cls: "bg-accent-soft/50 text-[oklch(0.3_0.08_264)]" },
    PROCESSING: { text: "Transcoding", cls: "bg-accent-soft/60 text-[oklch(0.3_0.08_264)]" },
    READY: { text: "Ready", cls: "bg-[oklch(0.92_0.06_150)] text-[oklch(0.35_0.1_150)]" },
    ERROR: { text: "Failed", cls: "bg-[oklch(0.94_0.05_25)] text-danger" },
  };
  const m = map[status] ?? map.QUEUED;
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${m.cls}`}>{m.text}</span>
  );
}

function Meta({ label }: { label: string }) {
  return <span className="rounded-md bg-panel px-2 py-1 text-[11px] text-ink2">{label}</span>;
}

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
