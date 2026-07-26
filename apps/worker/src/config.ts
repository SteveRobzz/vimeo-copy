import "dotenv/config";

// Worker-specific config. Storage/Redis/DB env is validated inside @vp/core and
// @vp/db; this only covers the transcode knobs the worker itself reads.
export const config = {
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? "1") || 1,
  ffmpegPath: process.env.FFMPEG_PATH ?? "ffmpeg",
  ffprobePath: process.env.FFPROBE_PATH ?? "ffprobe",
  preset: process.env.FFMPEG_PRESET ?? "veryfast",
  captions: {
    enabled: (process.env.ENABLE_CAPTIONS ?? "true") !== "false",
    bin: process.env.WHISPER_BIN ?? "whisper",
    model: process.env.WHISPER_MODEL ?? "tiny",
  },
} as const;
