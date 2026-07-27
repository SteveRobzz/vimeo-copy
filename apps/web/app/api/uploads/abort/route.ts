import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vp/db";
import { abortMultipartUpload } from "@vp/core/storage";

export const runtime = "nodejs";

// Best-effort cleanup when the user cancels or the upload fails. Aborting the
// multipart upload releases the partial bytes MinIO/R2 is holding.
export async function POST(req: NextRequest) {
  const { videoId, key, uploadId } = await req.json();

  if (key && uploadId) {
    try {
      await abortMultipartUpload(key, uploadId);
    } catch {
      // upload may not exist; ignore
    }
  }

  if (videoId) {
    await prisma.video
      .update({
        where: { id: videoId },
        data: { status: "ERROR", errorMessage: "Upload aborted" },
      })
      .catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
