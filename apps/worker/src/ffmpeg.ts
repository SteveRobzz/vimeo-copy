import { spawn } from "node:child_process";
import { config } from "./config";
import type { LadderRung } from "@vp/core";

/** Run a binary, streaming nothing but keeping the tail of stderr for errors. */
function run(
  bin: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: opts.cwd, env: opts.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => {
      // FFmpeg writes progress to stderr; keep only the last ~4KB.
      stderr = (stderr + d.toString()).slice(-4000);
    });
    child.on("error", (err) =>
      reject(new Error(`failed to spawn ${bin}: ${err.message}`))
    );
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${bin} exited ${code}\n${stderr}`));
    });
  });
}

export interface ProbeResult {
  durationSeconds: number;
  width: number;
  height: number;
  codec: string;
  hasAudio: boolean;
}

/** ffprobe the source: duration, dimensions, video codec, audio presence. */
export async function probe(inputPath: string): Promise<ProbeResult> {
  const out = await run(config.ffprobePath, [
    "-v",
    "error",
    "-show_entries",
    "stream=index,codec_type,codec_name,width,height",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    inputPath,
  ]);

  const json = JSON.parse(out) as {
    streams?: {
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
    }[];
    format?: { duration?: string };
  };

  const streams = json.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video");
  const hasAudio = streams.some((s) => s.codec_type === "audio");
  if (!video || !video.width || !video.height) {
    throw new Error("no decodable video stream found in source");
  }

  return {
    durationSeconds: Number(json.format?.duration ?? 0) || 0,
    width: video.width,
    height: video.height,
    codec: video.codec_name ?? "unknown",
    hasAudio,
  };
}

/**
 * Transcode one ladder rung to an HLS variant (fMPEG-TS segments + playlist).
 * Runs with cwd = the rung's output dir, writing index.m3u8 + seg_###.ts there.
 * Returns the scaled, even-numbered width ffmpeg used.
 */
export async function transcodeRung(
  inputPath: string,
  outDir: string,
  rung: LadderRung,
  hasAudio: boolean
): Promise<void> {
  const vb = `${rung.videoBitrateKbps}k`;
  const maxrate = `${Math.round(rung.videoBitrateKbps * 1.07)}k`;
  const bufsize = `${rung.videoBitrateKbps * 2}k`;

  const args = [
    "-y",
    "-i",
    inputPath,
    // Scale to the rung height, keep aspect, force even width (x264 requires it).
    "-vf",
    `scale=-2:${rung.height}`,
    "-c:v",
    "libx264",
    "-profile:v",
    "main",
    "-preset",
    config.preset,
    "-crf",
    "21",
    "-maxrate",
    maxrate,
    "-bufsize",
    bufsize,
    // Fixed GOP so segment boundaries align across renditions (clean ABR switch).
    "-g",
    "48",
    "-keyint_min",
    "48",
    "-sc_threshold",
    "0",
  ];

  if (hasAudio) {
    args.push("-c:a", "aac", "-b:a", `${rung.audioBitrateKbps}k`, "-ac", "2");
  } else {
    args.push("-an");
  }

  args.push(
    "-hls_time",
    "6",
    "-hls_playlist_type",
    "vod",
    "-hls_segment_filename",
    "seg_%03d.ts",
    "index.m3u8"
  );

  await run(config.ffmpegPath, args, { cwd: outDir });
}

/** Grab a single-frame JPEG poster at ~10% of the duration (min 1s). */
export async function thumbnail(
  inputPath: string,
  outPath: string,
  durationSeconds: number
): Promise<void> {
  const at = Math.max(1, Math.floor(durationSeconds * 0.1));
  await run(config.ffmpegPath, [
    "-y",
    "-ss",
    String(at),
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-vf",
    "scale=-2:720",
    "-q:v",
    "3",
    outPath,
  ]);
}

/** Extract mono 16kHz WAV for Whisper (its preferred input). */
export async function extractAudio(
  inputPath: string,
  outPath: string
): Promise<void> {
  await run(config.ffmpegPath, [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    outPath,
  ]);
}

export { run };
