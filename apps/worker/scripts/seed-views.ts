// Dev-only: fabricate realistic view analytics for the dashboard demo. Inserts
// View rows spread over the last 30 days (weighted per video) + syncs viewCount.
//   cd apps/worker && npx tsx scripts/seed-views.ts
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "@vp/db";

const user = await prisma.user.findUnique({ where: { email: "dev@local.test" } });
if (!user) throw new Error("dev user not found");

const videos = await prisma.video.findMany({
  where: { ownerId: user.id, status: "READY" },
  select: { id: true },
  orderBy: { createdAt: "asc" },
});

// Descending weights so "most viewed" ordering is meaningful.
const weights = [28, 17, 11, 6, 4, 3, 2];

let total = 0;
for (let vi = 0; vi < videos.length; vi++) {
  const v = videos[vi];
  const n = weights[vi] ?? 2;
  const rows = Array.from({ length: n }, () => {
    // Bias recent days a little (squared random) for a natural-looking ramp.
    const daysAgo = Math.floor(Math.pow(Math.random(), 1.6) * 30);
    const created = new Date();
    created.setDate(created.getDate() - daysAgo);
    created.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
    return {
      videoId: v.id,
      ipHash: randomBytes(16).toString("hex"),
      watchedSeconds: Math.floor(15 + Math.random() * 285),
      createdAt: created,
    };
  });
  await prisma.view.createMany({ data: rows });
  await prisma.video.update({ where: { id: v.id }, data: { viewCount: { increment: n } } });
  total += n;
}

console.log(`seeded ${total} views across ${videos.length} videos`);
await prisma.$disconnect();
