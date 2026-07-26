import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vp/db";

export const runtime = "nodejs";

// Poll target for the upload UI: returns the live pipeline state for a video so
// the page can animate QUEUED → PROCESSING → READY as the worker (Step 4) runs.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const video = await prisma.video.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      status: true,
      errorMessage: true,
      durationSeconds: true,
      sourceWidth: true,
      sourceHeight: true,
      thumbnailKey: true,
      renditions: {
        select: { label: true, height: true, bitrateKbps: true },
        orderBy: { height: "asc" },
      },
    },
  });

  if (!video) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(video);
}
