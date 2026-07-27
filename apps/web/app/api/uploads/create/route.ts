import { NextRequest, NextResponse } from "next/server";
import { prisma, Privacy } from "@vp/db";
import { createMultipartUpload, sourceKey } from "@vp/core/storage";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const PRIVACIES = new Set<string>(Object.values(Privacy));

// Begins a resumable upload: creates the Video row (status UPLOADING), opens an
// S3 multipart upload, and returns the ids the browser needs to push parts.
export async function POST(req: NextRequest) {
  const { filename, contentType, title, privacy } = await req.json();
  if (!filename || !contentType) {
    return NextResponse.json(
      { error: "filename and contentType are required" },
      { status: 400 }
    );
  }

  const user = await getCurrentUser();

  const video = await prisma.video.create({
    data: {
      ownerId: user.id,
      title: (typeof title === "string" && title.trim()) || filename,
      originalFilename: filename,
      status: "UPLOADING",
      // Fall back to the schema default (PRIVATE) if omitted/invalid.
      ...(PRIVACIES.has(privacy) ? { privacy: privacy as Privacy } : {}),
    },
  });

  const key = sourceKey(video.id, filename);
  const uploadId = await createMultipartUpload(key, contentType);

  await prisma.video.update({
    where: { id: video.id },
    data: { sourceObjectKey: key },
  });

  return NextResponse.json({ videoId: video.id, key, uploadId });
}
