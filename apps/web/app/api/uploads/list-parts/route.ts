import { NextRequest, NextResponse } from "next/server";
import { listParts } from "@vp/core/storage";

export const runtime = "nodejs";

// Supports resume: tells the client which parts already made it to storage so it
// can skip re-uploading them after an interruption.
export async function POST(req: NextRequest) {
  const { key, uploadId } = await req.json();
  if (!key || !uploadId) {
    return NextResponse.json(
      { error: "key and uploadId are required" },
      { status: 400 }
    );
  }
  const parts = await listParts(key, uploadId);
  return NextResponse.json({ parts });
}
