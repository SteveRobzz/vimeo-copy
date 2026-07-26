"use client";

import { useMemo, useState } from "react";
import Uppy, { type UppyFile } from "@uppy/core";
import { Dashboard } from "@uppy/react";
import AwsS3 from "@uppy/aws-s3";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

type Done = { videoId: string; title: string };

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return res.json();
}

export default function UploadPage() {
  const [done, setDone] = useState<Done[]>([]);

  const uppy = useMemo(() => {
    const u = new Uppy({
      autoProceed: false,
      restrictions: {
        maxNumberOfFiles: 1,
        allowedFileTypes: ["video/*"],
      },
    });

    u.use(AwsS3, {
      // Always multipart so uploads are chunked + resumable, even for smaller files.
      shouldUseMultipart: () => true,

      async createMultipartUpload(file: UppyFile<any, any>) {
        const { videoId, key, uploadId } = await postJson("/api/uploads/create", {
          filename: file.name,
          contentType: file.type,
          title: file.name,
        });
        // Stash videoId so completeMultipartUpload can enqueue against it.
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

    u.on("complete", (result) => {
      const finished = result.successful ?? [];
      setDone((prev) => [
        ...prev,
        ...finished.map((f) => ({
          videoId: String(f.meta.videoId ?? ""),
          title: f.name ?? "video",
        })),
      ]);
    });

    return u;
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload a video</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Chunked, resumable upload straight to object storage. On completion a
          transcode job is enqueued.
        </p>
      </div>

      <Dashboard uppy={uppy} proudlyDisplayPoweredByUppy={false} height={340} />

      {done.length > 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm">
          <p className="mb-2 font-medium text-neutral-200">Queued for transcode</p>
          <ul className="space-y-1 text-neutral-400">
            {done.map((d) => (
              <li key={d.videoId}>
                <span className="text-neutral-200">{d.title}</span> —{" "}
                <code className="text-xs text-neutral-500">{d.videoId}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
