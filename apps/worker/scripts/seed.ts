// Dev helper: generate a real MP4 with ffmpeg, upload it to storage as a video
// source, and enqueue a transcode job — i.e. reproduce what the web app does on
// upload-complete, without a browser. Then run `pnpm dev:worker` to process it.
//
//   cd apps/worker && npx tsx scripts/seed.ts
import "dotenv/config";
import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { prisma } from "@vp/db";
import { JOB_NAMES } from "@vp/core";
import { putObject, sourceKey } from "@vp/core/storage";
import { transcodeQueue } from "@vp/core/queue";

const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const c = spawn(bin, args);
    let err = "";
    c.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
    c.on("error", reject);
    c.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${bin} exited ${code}\n${err}`))
    );
  });
}

async function main() {
  // Optionally seed an existing file (e.g. one with real speech for captions):
  //   npx tsx scripts/seed.ts path\to\clip.mp4
  const inputArg = process.argv[2];
  const filename = `seed-${Date.now()}.mp4`;
  const tmp = join(tmpdir(), filename);

  if (inputArg) {
    console.log("1) using provided clip:", inputArg);
    const { copyFile } = await import("node:fs/promises");
    await copyFile(inputArg, tmp);
  } else {
    console.log("1) generating a 6s 720p test clip with ffmpeg…");
    await run(ffmpeg, [
      "-y",
      "-f", "lavfi", "-i", "testsrc=duration=6:size=1280x720:rate=30",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-shortest", tmp,
    ]);
  }

  const user = await prisma.user.upsert({
    where: { email: "dev@local.test" },
    update: {},
    create: { email: "dev@local.test", name: "Dev" },
  });

  const video = await prisma.video.create({
    data: {
      ownerId: user.id,
      title: "Seed test clip",
      originalFilename: filename,
      status: "QUEUED",
    },
  });

  const key = sourceKey(video.id, filename);
  await prisma.video.update({ where: { id: video.id }, data: { sourceObjectKey: key } });

  console.log("2) uploading source to storage:", key);
  await putObject(key, await readFile(tmp), "video/mp4");

  console.log("3) enqueuing transcode job…");
  await transcodeQueue().add(
    JOB_NAMES.TRANSCODE_VIDEO,
    { videoId: video.id, sourceObjectKey: key },
    { jobId: video.id, attempts: 1, removeOnComplete: 100, removeOnFail: 500 }
  );

  await rm(tmp, { force: true });
  console.log(`\n✅ seeded videoId=${video.id} (status QUEUED). Start the worker to process it.`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
