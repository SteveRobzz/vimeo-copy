import { NextRequest, NextResponse } from "next/server";
import { prisma, Privacy } from "@vp/db";
import { deletePrefix, videoPrefix } from "@vp/core/storage";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const PRIVACIES = new Set<string>(Object.values(Privacy));

// Load a video the caller owns, or null. Centralizes the ownership check so a
// user can never edit/delete someone else's video.
async function ownedVideo(id: string) {
  const user = await getCurrentUser();
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video || video.ownerId !== user.id) return null;
  return video;
}

// PATCH: update editable metadata (title, description, privacy).
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const video = await ownedVideo(params.id);
  if (!video) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { title?: string; description?: string | null; privacy?: Privacy } = {};

  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    data.title = t.slice(0, 200);
  }
  if (typeof body.description === "string") {
    data.description = body.description.trim().slice(0, 5000) || null;
  }
  if (typeof body.privacy === "string") {
    if (!PRIVACIES.has(body.privacy)) {
      return NextResponse.json({ error: "invalid privacy" }, { status: 400 });
    }
    data.privacy = body.privacy as Privacy;
  }

  const updated = await prisma.video.update({ where: { id: video.id }, data });
  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    description: updated.description,
    privacy: updated.privacy,
  });
}

// DELETE: remove the video, its DB children (cascade), and all storage objects.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const video = await ownedVideo(params.id);
  if (!video) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Storage first: if this fails we keep the row so the delete can be retried,
  // rather than orphaning objects with no DB record pointing at them.
  await deletePrefix(videoPrefix(video.id));
  await prisma.video.delete({ where: { id: video.id } });

  return NextResponse.json({ ok: true });
}
