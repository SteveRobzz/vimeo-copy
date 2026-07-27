"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatBytes,
  formatCompact,
  formatDuration,
  formatRelativeTime,
} from "@/lib/format";

export type DashVideo = {
  id: string;
  title: string;
  description: string;
  status: "UPLOADING" | "QUEUED" | "PROCESSING" | "READY" | "ERROR";
  privacy: "PUBLIC" | "UNLISTED" | "PRIVATE";
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
  viewCount: number;
  renditionCount: number;
  storageBytes: number;
  createdAt: string;
};

type Sort = "newest" | "oldest" | "views" | "title";

export default function VideosPanel({ videos: initial }: { videos: DashVideo[] }) {
  const router = useRouter();
  const [videos, setVideos] = useState(initial);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [privacy, setPrivacy] = useState("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [editing, setEditing] = useState<DashVideo | null>(null);
  const [deleting, setDeleting] = useState<DashVideo | null>(null);

  useEffect(() => setVideos(initial), [initial]);

  const filtered = useMemo(() => {
    let list = videos.filter((v) => {
      if (query && !v.title.toLowerCase().includes(query.toLowerCase())) return false;
      if (status !== "all" && v.status !== status) return false;
      if (privacy !== "all" && v.privacy !== privacy) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "views") return b.viewCount - a.viewCount;
      if (sort === "title") return a.title.localeCompare(b.title);
      const at = +new Date(a.createdAt);
      const bt = +new Date(b.createdAt);
      return sort === "oldest" ? at - bt : bt - at;
    });
    return list;
  }, [videos, query, status, privacy, sort]);

  function onSaved(updated: DashVideo) {
    setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    setEditing(null);
    router.refresh();
  }
  function onDeleted(id: string) {
    setVideos((prev) => prev.filter((v) => v.id !== id));
    setDeleting(null);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-line bg-white shadow-card">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
        <h2 className="text-sm font-bold">
          Your videos <span className="ml-1 text-ink3">{videos.length}</span>
        </h2>
        <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-40 rounded-lg border border-line2 bg-panel px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
          <Select value={status} onChange={setStatus} label="Status">
            <option value="all">All statuses</option>
            <option value="READY">Ready</option>
            <option value="PROCESSING">Processing</option>
            <option value="QUEUED">Queued</option>
            <option value="ERROR">Failed</option>
          </Select>
          <Select value={privacy} onChange={setPrivacy} label="Privacy">
            <option value="all">All privacy</option>
            <option value="PUBLIC">Public</option>
            <option value="UNLISTED">Unlisted</option>
            <option value="PRIVATE">Private</option>
          </Select>
          <Select value={sort} onChange={(v) => setSort(v as Sort)} label="Sort">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="views">Most viewed</option>
            <option value="title">Title A–Z</option>
          </Select>
        </div>
      </div>

      {/* Column header */}
      <div className="hidden grid-cols-[1fr_120px_110px_90px_110px_40px] gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink3 md:grid">
        <span>Video</span>
        <span>Status</span>
        <span>Privacy</span>
        <span className="text-right">Views</span>
        <span className="text-right">Uploaded</span>
        <span />
      </div>

      <div className="divide-y divide-line">
        {filtered.map((v) => (
          <Row key={v.id} v={v} onEdit={() => setEditing(v)} onDelete={() => setDeleting(v)} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="grid place-items-center gap-3 p-12 text-center">
          <p className="text-sm text-ink3">
            {videos.length === 0 ? "No videos yet." : "No videos match your filters."}
          </p>
          {videos.length === 0 && (
            <Link
              href="/upload"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white transition hover:bg-accent-hover"
            >
              Upload your first video
            </Link>
          )}
        </div>
      )}

      {editing && <EditModal video={editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
      {deleting && <DeleteDialog video={deleting} onClose={() => setDeleting(null)} onDeleted={onDeleted} />}
    </section>
  );
}

function Row({ v, onEdit, onDelete }: { v: DashVideo; onEdit: () => void; onDelete: () => void }) {
  const meta = [
    v.durationSeconds ? formatDuration(v.durationSeconds) : null,
    v.width && v.height ? `${v.height}p` : null,
    v.renditionCount ? `${v.renditionCount} renditions` : null,
    v.storageBytes ? formatBytes(v.storageBytes) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="grid grid-cols-1 items-center gap-3 px-4 py-3 transition hover:bg-panel2 md:grid-cols-[1fr_120px_110px_90px_110px_40px]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg border border-line2 bg-panel">
          {v.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-ink3">▶</div>
          )}
          {v.durationSeconds ? (
            <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 font-mono text-[10px] text-white">
              {formatDuration(v.durationSeconds)}
            </span>
          ) : null}
        </div>
        <div className="min-w-0">
          {v.status === "READY" ? (
            <Link href={`/watch/${v.id}`} className="block truncate text-sm font-bold hover:text-accent">
              {v.title}
            </Link>
          ) : (
            <span className="block truncate text-sm font-bold">{v.title}</span>
          )}
          <p className="truncate text-xs text-ink3">{meta || "—"}</p>
        </div>
      </div>

      <div><StatusBadge status={v.status} /></div>
      <div><PrivacyBadge privacy={v.privacy} /></div>
      <div className="text-sm text-ink2 md:text-right">
        {formatCompact(v.viewCount)}
        <span className="text-ink3 md:hidden"> views</span>
      </div>
      <div className="text-xs text-ink3 md:text-right">{formatRelativeTime(v.createdAt)}</div>

      <RowMenu v={v} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function RowMenu({ v, onEdit, onDelete }: { v: DashVideo; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function copyLink() {
    navigator.clipboard?.writeText(`${location.origin}/watch/${v.id}`);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative justify-self-start md:justify-self-center">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Video actions"
        className="grid h-8 w-8 place-items-center rounded-lg text-ink3 transition hover:bg-panel hover:text-ink"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-pop">
          {v.status === "READY" && <MenuItem href={`/watch/${v.id}`}>Open</MenuItem>}
          <MenuItem onClick={copyLink}>Copy link</MenuItem>
          <MenuItem onClick={() => { setOpen(false); onEdit(); }}>Edit details</MenuItem>
          <MenuItem danger onClick={() => { setOpen(false); onDelete(); }}>Delete</MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  href,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const cls = `block w-full px-3 py-1.5 text-left text-sm transition ${
    danger ? "text-danger hover:bg-[oklch(0.96_0.03_25)]" : "text-ink2 hover:bg-panel hover:text-ink"
  }`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button onClick={onClick} className={cls}>{children}</button>;
}

function EditModal({
  video,
  onClose,
  onSaved,
}: {
  video: DashVideo;
  onClose: () => void;
  onSaved: (v: DashVideo) => void;
}) {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description);
  const [privacy, setPrivacy] = useState(video.privacy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description, privacy }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Save failed");
      const data = await res.json();
      onSaved({ ...video, title: data.title, description: data.description ?? "", privacy: data.privacy });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h3 className="text-lg font-bold">Edit details</h3>
      <label className="mt-4 block text-xs font-semibold text-ink2">Title</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line2 bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <label className="mt-3 block text-xs font-semibold text-ink2">Description</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="mt-1 w-full resize-none rounded-lg border border-line2 bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <label className="mt-3 block text-xs font-semibold text-ink2">Visibility</label>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {(["PUBLIC", "UNLISTED", "PRIVATE"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPrivacy(p)}
            className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
              privacy === p ? "border-accent bg-accent-soft/40" : "border-line2 text-ink2 hover:border-ink3"
            }`}
          >
            {p[0] + p.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-ink2 hover:text-ink">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={busy || !title.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </Overlay>
  );
}

function DeleteDialog({
  video,
  onClose,
  onDeleted,
}: {
  video: DashVideo;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${video.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      onDeleted(video.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h3 className="text-lg font-bold">Delete video?</h3>
      <p className="mt-2 text-sm text-ink2">
        <span className="font-semibold text-ink">{video.title}</span> and all its renditions,
        captions, and analytics will be permanently removed. This can’t be undone.
      </p>
      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-ink2 hover:text-ink">
          Cancel
        </button>
        <button
          onClick={del}
          disabled={busy}
          className="rounded-lg bg-danger px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Delete permanently"}
        </button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-pop">
        {children}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DashVideo["status"] }) {
  const map = {
    READY: { t: "Ready", c: "text-[oklch(0.45_0.13_150)]", d: "bg-[oklch(0.55_0.15_150)]" },
    PROCESSING: { t: "Processing", c: "text-accent", d: "bg-accent animate-pulse" },
    QUEUED: { t: "Queued", c: "text-accent", d: "bg-accent" },
    UPLOADING: { t: "Uploading", c: "text-ink3", d: "bg-ink3" },
    ERROR: { t: "Failed", c: "text-danger", d: "bg-danger" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${map.c}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${map.d}`} />
      {map.t}
    </span>
  );
}

function PrivacyBadge({ privacy }: { privacy: DashVideo["privacy"] }) {
  const map = {
    PUBLIC: { t: "Public", i: "🌐" },
    UNLISTED: { t: "Unlisted", i: "🔗" },
    PRIVATE: { t: "Private", i: "🔒" },
  }[privacy];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink2">
      <span className="text-[10px]">{map.i}</span>
      {map.t}
    </span>
  );
}

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-line2 bg-panel px-2.5 py-1.5 text-sm text-ink2 outline-none focus:border-accent"
    >
      {children}
    </select>
  );
}
