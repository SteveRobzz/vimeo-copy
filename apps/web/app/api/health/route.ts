import { NextResponse } from "next/server";

// Lightweight liveness check. We deliberately do NOT hit the DB here so the
// route works before migrations are run. A DB-backed readiness check comes later.
export async function GET() {
  return NextResponse.json({ ok: true, service: "web", ts: Date.now() });
}
