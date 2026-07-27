import { NextRequest, NextResponse } from "next/server";
import { signUploadPart } from "@vp/core/storage";

export const runtime = "nodejs";

// Returns a short-lived presigned URL for one chunk. The browser PUTs the chunk
// bytes directly to object storage — they never pass through this function.
export async function POST(req: NextRequest) {
  const { key, uploadId, partNumber } = await req.json();
  if (!key || !uploadId || !partNumber) {
    return NextResponse.json(
      { error: "key, uploadId and partNumber are required" },
      { status: 400 }
    );
  }
  const url = await signUploadPart(key, uploadId, Number(partNumber));
  return NextResponse.json({ url });
}
