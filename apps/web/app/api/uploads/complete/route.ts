import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vp/db";
import { completeMultipartUpload } from "@vp/core/storage";
import { transcodeQueue } from "@vp/core/queue";
import { JOB_NAMES } from "@vp/core";

export const runtime = "nodejs";

// Finalizes the multipart upload, flips the Video to QUEUED, and enqueues the
// transcode job. jobId = videoId makes this idempotent (no duplicate jobs).
export async function POST(req: NextRequest) {
  const { videoId, key, uploadId, parts } = await req.json();
  if (!videoId || !key || !uploadId || !Array.isArray(parts)) {
    return NextResponse.json(
      { error: "videoId, key, uploadId and parts[] are required" },
      { status: 400 }
    );
  }

  await completeMultipartUpload(key, uploadId, parts);

  const video = await prisma.video.update({
    where: { id: videoId },
    data: { status: "QUEUED" },
  });

  await transcodeQueue().add(
    JOB_NAMES.TRANSCODE_VIDEO,
    { videoId, sourceObjectKey: key },
    {
      jobId: videoId,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    }
  );

  return NextResponse.json({ ok: true, videoId: video.id, status: video.status });
}
