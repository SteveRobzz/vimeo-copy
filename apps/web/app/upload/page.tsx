"use client";

import { useEffect, useRef, useState } from "react";
import Uppy, { type UppyFile } from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import AwsS3 from "@uppy/aws-s3";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

type Status = "QUEUED" | "PROCESSING" | "READY" | "ERROR" | "UPLOADING";

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

export default function UploadPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const uppyRef = useRef<Uppy | null>(null);
  // videoId -> live status (populated by polling after each upload completes).
  const [videos, setVideos] = useState<Record<string, VideoStatus>>({});
  const order = useRef<string[]>([]);

  useEffect(() => {
    if (uppyRef.current || !mountRef.current) return;

    const u = new Uppy({
      autoProceed: false,
      restrictions: { maxNumberOfFiles: 5, allowedFileTypes: ["video/*"] },
    });

    u.use(AwsS3, {
      // Always multipart so uploads are chunked + resumable, even for small files.
      shouldUseMultipart: true,

      async createMultipartUpload(file: UppyFile<any, any>) {
        const { videoId, key, uploadId } = await postJson("/api/uploads/create", {
          filename: file.name,
          contentType: file.type,
          title: file.name,
        });
        u.setFileMeta(file.id, { videoId });
        return { uploadId, key };
      },

      async signPart(_file, { uploadId, key, partNumber }) {
        const { url } = await postJson("/api/uploads/sign-part", {
          uploadId,
          key,
          partNumber,
        });
        return { url };
      },

      async listParts(_file, { uploadId, key }) {
        const { parts } = await postJson("/api/uploads/list-parts", {
          uploadId,
          key,
        });
        return parts;
      },

      async completeMultipartUpload(file, { uploadId, key, parts }) {
        await postJson("/api/uploads/complete", {
          videoId: file.meta.videoId,
          uploadId,
          key,
          parts,
        });
        return {};
      },

      async abortMultipartUpload(file, { uploadId, key }) {
        await postJson("/api/uploads/abort", {
          videoId: file.meta.videoId,
          uploadId,
          key,
        });
      },
    });

    u.use(Dashboard, {
      target: mountRef.current,
      inline: true,
      height: 340,
      theme: "dark",
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

  // Poll pipeline status for any video that hasn't reached a terminal state.
  useEffect(() => {
    const iv = setInterval(async () => {
      const active = Object.values(videos).filter(
        (v) => !TERMINAL.includes(v.status)
      );
      if (active.length === 0) return;
      await Promise.all(
        active.map(async (v) => {
          try {
            const res = await fetch(`/api/videos/${v.id}/status`, {
              cache: "no-store",
            });
            if (!res.ok) return;
            const data: VideoStatus = await res.json();
            setVideos((prev) => ({ ...prev, [v.id]: { ...prev[v.id], ...data } }));
          } catch {
            /* transient — try again next tick */
          }
        })
      );
    }, 2500);
    return () => clearInterval(iv);
  }, [videos]);

  const tracked = order.current.map((id) => videos[id]).filter(Boolean);

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink text-brand-50">
      {/* Animated blue aurora background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink-800 to-[#081334]" />
        <div className="absolute -left-24 top-[-10%] h-[28rem] w-[28rem] rounded-full bg-brand-700/40 blur-[120px] animate-blob" />
        <div className="absolute right-[-8%] top-[20%] h-[26rem] w-[26rem] rounded-full bg-brand-500/30 blur-[120px] animate-blob-slow" />
        <div className="absolute bottom-[-15%] left-[30%] h-[24rem] w-[24rem] rounded-full bg-brand-400/25 blur-[130px] animate-blob" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#7db4ff 1px, transparent 1px), linear-gradient(90deg, #7db4ff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-14">
        <a
          href="/"
          className="w-fit text-xs font-medium text-brand-300 transition hover:text-brand-100"
        >
          ← Back home
        </a>

        {/* Hero */}
        <header className="space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-200">
            <span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-brand-400" />
            Resumable · chunked · direct-to-storage
          </span>
          <h1 className="bg-gradient-to-r from-brand-100 via-brand-300 to-brand-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
            Upload a video
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-slate-400">
            Bytes stream straight from your browser to object storage in
            resumable chunks — never through the server. The moment an upload
            finishes, a{" "}
            <span className="text-brand-300">FFmpeg transcode job</span> is
            queued and you'll watch it move through the pipeline live.
          </p>
        </header>

        {/* Feature chips */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "Chunked", v: "Multipart S3" },
            { k: "Resumable", v: "Survives refresh" },
            { k: "Adaptive", v: "HLS ladder" },
            { k: "Captions", v: "Whisper ASR" },
          ].map((c) => (
            <div
              key={c.k}
              className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 backdrop-blur transition hover:border-brand-500/40 hover:bg-brand-500/[0.06]"
            >
              <div className="text-sm font-semibold text-brand-100">{c.k}</div>
              <div className="text-[11px] text-slate-500">{c.v}</div>
            </div>
          ))}
        </div>

        {/* Uploader card */}
        <div className="vp-uppy rounded-[22px] border border-brand-500/20 bg-white/[0.02] p-2 shadow-glow">
          <div ref={mountRef} />
        </div>

        {/* Live pipeline */}
        {tracked.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand-300 to-brand-600" />
              Transcode pipeline
            </h2>
            <div className="space-y-3">
              {tracked.map((v) => (
                <PipelineCard key={v.id} v={v} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

/* ---- Live status card for a single video ---- */

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
      className={`overflow-hidden rounded-2xl border p-4 backdrop-blur transition ${
        isError
          ? "border-rose-500/40 bg-rose-500/[0.06]"
          : isReady
          ? "border-brand-400/50 bg-brand-500/[0.08] shadow-glow-sm"
          : "border-brand-500/20 bg-white/[0.03]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-brand-50">{v.title}</p>
          <code className="text-[11px] text-slate-500">{v.id}</code>
        </div>
        <StatusBadge status={v.status} />
      </div>

      {/* Stepper */}
      {!isError && (
        <div className="mt-4 flex items-center gap-2">
          {STEPS.map((s, i) => {
            const reached = i <= active;
            const current = i === active && !isReady;
            return (
              <div key={s.key} className="flex flex-1 items-center gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold transition ${
                      reached
                        ? "bg-gradient-to-br from-brand-300 to-brand-600 text-white"
                        : "bg-white/5 text-slate-500"
                    } ${current ? "animate-pulse-ring" : ""}`}
                  >
                    {i < active || isReady ? "✓" : i + 1}
                  </span>
                  <span
                    className={`text-xs ${
                      reached ? "text-brand-100" : "text-slate-500"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="h-px flex-1 bg-white/10">
                    <div
                      className={`h-px transition-all duration-500 ${
                        i < active
                          ? "w-full bg-gradient-to-r from-brand-400 to-brand-600"
                          : "w-0"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Processing shimmer bar */}
      {v.status === "PROCESSING" && (
        <div className="vp-shimmer mt-4 h-1.5 w-full rounded-full bg-brand-900/60" />
      )}

      {/* Error */}
      {isError && v.errorMessage && (
        <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {v.errorMessage}
        </p>
      )}

      {/* Ready details */}
      {isReady && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {v.durationSeconds != null && (
            <Meta label={fmtDuration(v.durationSeconds)} />
          )}
          {v.sourceWidth && v.sourceHeight && (
            <Meta label={`${v.sourceWidth}×${v.sourceHeight} source`} />
          )}
          {v.renditions.map((r) => (
            <span
              key={r.label}
              className="rounded-md border border-brand-400/40 bg-brand-500/15 px-2 py-1 text-[11px] font-semibold text-brand-100"
            >
              {r.label}
            </span>
          ))}
          <a
            href={`/watch/${v.id}`}
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-gradient-to-br from-brand-400 to-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-glow-sm transition hover:brightness-110"
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
    UPLOADING: { text: "Uploading", cls: "border-slate-500/40 bg-slate-500/10 text-slate-300" },
    QUEUED: { text: "Queued", cls: "border-brand-300/40 bg-brand-300/10 text-brand-200" },
    PROCESSING: { text: "Transcoding", cls: "border-brand-400/50 bg-brand-500/15 text-brand-100" },
    READY: { text: "Ready", cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" },
    ERROR: { text: "Failed", cls: "border-rose-400/40 bg-rose-400/10 text-rose-200" },
  };
  const m = map[status] ?? map.QUEUED;
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${m.cls}`}
    >
      {m.text}
    </span>
  );
}

function Meta({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-300">
      {label}
    </span>
  );
}

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
