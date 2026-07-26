import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pipeline } from "node:stream/promises";

import { prisma } from "@vp/db";
import { QUALITY_LADDER, type TranscodeJobData, type LadderRung } from "@vp/core";
import {
  getObjectStream,
  putObject,
  hlsMasterKey,
  hlsVariantKey,
  hlsPrefix,
  thumbnailKey,
  captionKey,
} from "@vp/core/storage";

import { config } from "./config";
import { jobLogger } from "./logger";
import {
  probe,
  transcodeRung,
  thumbnail as makeThumbnail,
  extractAudio,
} from "./ffmpeg";
import { buildMasterPlaylist, scaledWidth, type VariantInfo } from "./hls";
import { generateCaptions } from "./captions";

const CT = {
  m3u8: "application/vnd.apple.mpegurl",
  ts: "video/mp2t",
  jpg: "image/jpeg",
  vtt: "text/vtt",
} as const;

/** Pick the ladder rungs to render: never upscale past the source height, but
 *  always emit at least one rung (source height itself if it's below 360p). */
function selectRungs(sourceHeight: number): LadderRung[] {
  const fit = QUALITY_LADDER.filter((r) => r.height <= sourceHeight);
  if (fit.length > 0) return fit;
  const evenH = sourceHeight % 2 === 0 ? sourceHeight : sourceHeight - 1;
  return [{ ...QUALITY_LADDER[0], height: evenH, label: `${evenH}p` }];
}

export async function runTranscode(data: TranscodeJobData): Promise<void> {
  const { videoId, sourceObjectKey } = data;
  const log = jobLogger(videoId);
  const work = join(tmpdir(), `vp-transcode-${videoId}`);

  await prisma.video.update({
    where: { id: videoId },
    data: { status: "PROCESSING", errorMessage: null },
  });

  try {
    await mkdir(work, { recursive: true });

    // 1) Download the source from object storage to local disk.
    const sourcePath = join(work, "source");
    log.info("downloading source", { key: sourceObjectKey });
    await pipeline(await getObjectStream(sourceObjectKey), createWriteStream(sourcePath));

    // 2) Probe: duration, dimensions, codec, audio presence.
    const meta = await probe(sourcePath);
    log.info("probed", meta);
    await prisma.video.update({
      where: { id: videoId },
      data: {
        durationSeconds: meta.durationSeconds,
        sourceWidth: meta.width,
        sourceHeight: meta.height,
        sourceCodec: meta.codec,
      },
    });

    // 3) Transcode each ladder rung to an HLS variant and upload it.
    const rungs = selectRungs(meta.height);
    log.info("quality ladder", { rungs: rungs.map((r) => r.label) });
    const variants: VariantInfo[] = [];

    for (const rung of rungs) {
      const outDir = join(work, rung.label);
      await mkdir(outDir, { recursive: true });
      log.info("transcoding rung", { label: rung.label });
      await transcodeRung(sourcePath, outDir, rung, meta.hasAudio);

      const width = scaledWidth(meta.width, meta.height, rung.height);
      const bitrateKbps = rung.videoBitrateKbps + rung.audioBitrateKbps;

      // Upload playlist + every segment for this rung.
      const files = await readdir(outDir);
      let bytes = 0;
      for (const f of files) {
        const buf = await readFile(join(outDir, f));
        bytes += buf.length;
        const key = `${hlsPrefix(videoId)}/${rung.label}/${f}`;
        await putObject(key, buf, f.endsWith(".m3u8") ? CT.m3u8 : CT.ts);
      }

      await prisma.rendition.upsert({
        where: { videoId_label: { videoId, label: rung.label } },
        create: {
          videoId,
          label: rung.label,
          width,
          height: rung.height,
          bitrateKbps,
          playlistKey: hlsVariantKey(videoId, rung.label),
          fileSizeBytes: BigInt(bytes),
        },
        update: {
          width,
          height: rung.height,
          bitrateKbps,
          playlistKey: hlsVariantKey(videoId, rung.label),
          fileSizeBytes: BigInt(bytes),
        },
      });

      variants.push({
        label: rung.label,
        width,
        height: rung.height,
        bandwidthBps: bitrateKbps * 1000,
      });
      log.info("rung done", { label: rung.label, bytes });
    }

    // 4) Master playlist that ties the variants together.
    const master = buildMasterPlaylist(variants);
    await putObject(hlsMasterKey(videoId), master, CT.m3u8);

    // 5) Poster thumbnail.
    const thumbPath = join(work, "thumb.jpg");
    await makeThumbnail(sourcePath, thumbPath, meta.durationSeconds);
    await putObject(thumbnailKey(videoId), await readFile(thumbPath), CT.jpg);

    // 6) Captions (best-effort; only if there's an audio track).
    if (meta.hasAudio) {
      const audioPath = join(work, "audio.wav");
      await extractAudio(sourcePath, audioPath);
      const cap = await generateCaptions(audioPath, work, log);
      if (cap) {
        const key = captionKey(videoId, cap.language);
        await putObject(key, await readFile(cap.vttPath), CT.vtt);
        await prisma.caption.upsert({
          where: { videoId_language: { videoId, language: cap.language } },
          create: {
            videoId,
            language: cap.language,
            label: "English (auto)",
            isAutoGenerated: true,
            isDefault: true,
            objectKey: key,
          },
          update: { objectKey: key },
        });
      }
    } else {
      log.info("no audio track — skipping captions");
    }

    // 7) Mark ready.
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "READY",
        hlsMasterKey: hlsMasterKey(videoId),
        thumbnailKey: thumbnailKey(videoId),
      },
    });
    log.info("READY", { variants: variants.map((v) => v.label) });
  } finally {
    // Always clean up the scratch dir, success or failure.
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}
