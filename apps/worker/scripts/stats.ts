import "dotenv/config";
import { prisma } from "@vp/db";

const user = await prisma.user.findUnique({ where: { email: "dev@local.test" } });
const videos = await prisma.video.findMany({
  where: { ownerId: user!.id },
  select: { id: true, title: true, status: true, viewCount: true, _count: { select: { views: true } } },
  orderBy: { viewCount: "desc" },
});
const watch = await prisma.view.aggregate({ _sum: { watchedSeconds: true }, where: { video: { ownerId: user!.id } } });
console.log("videos:", videos.length, "| totalViews:", videos.reduce((s, v) => s + v.viewCount, 0), "| watchSecs:", watch._sum.watchedSeconds);
for (const v of videos) console.log(`  ${v.status.padEnd(11)} views=${v.viewCount} (rows=${v._count.views})  ${v.title}`);
await prisma.$disconnect();
