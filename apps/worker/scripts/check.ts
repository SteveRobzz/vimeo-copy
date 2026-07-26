// Dev helper: print a video's pipeline state + artifacts.
//   cd apps/worker && npx tsx scripts/check.ts <videoId>
import "dotenv/config";
import { prisma } from "@vp/db";

const id = process.argv[2];
const v = await prisma.video.findUnique({
  where: { id },
  include: { renditions: { orderBy: { height: "asc" } }, captions: true },
});
console.log(
  v
    ? JSON.stringify(
        {
          status: v.status,
          err: v.errorMessage,
          dur: v.durationSeconds,
          dims: v.sourceWidth && `${v.sourceWidth}x${v.sourceHeight}`,
          master: v.hlsMasterKey,
          thumb: v.thumbnailKey,
          renditions: v.renditions.map((r) => `${r.label}:${r.width}x${r.height}`),
          captions: v.captions.map((c) => `${c.language}(${c.label},default=${c.isDefault}):${c.objectKey}`),
        },
        null,
        2
      )
    : "NOTFOUND"
);
await prisma.$disconnect();
