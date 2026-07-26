import { join, dirname, isAbsolute, delimiter } from "node:path";
import { readdir } from "node:fs/promises";
import { config } from "./config";
import { run } from "./ffmpeg";
import { jobLogger } from "./logger";

// Whisper shells out to `ffmpeg` (by bare name) to decode audio, so it must be
// on PATH. When we know ffmpeg's absolute location, prepend its directory to the
// child's PATH so captions work even if ffmpeg isn't on the global PATH.
function whisperEnv(): NodeJS.ProcessEnv {
  if (!isAbsolute(config.ffmpegPath)) return process.env;
  const dir = dirname(config.ffmpegPath);
  return { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH ?? ""}` };
}

/**
 * Best-effort caption generation via a Whisper CLI. Captions are a nice-to-have,
 * so any failure here (whisper not installed, model download issue, etc.) is
 * logged and swallowed — it must never fail an otherwise-good transcode.
 *
 * Returns the local .vtt path + language on success, or null if skipped/failed.
 */
export async function generateCaptions(
  audioPath: string,
  outDir: string,
  log: ReturnType<typeof jobLogger>
): Promise<{ vttPath: string; language: string } | null> {
  if (!config.captions.enabled) {
    log.info("captions disabled — skipping");
    return null;
  }

  try {
    // openai-whisper: writes <audio-basename>.vtt into --output_dir.
    await run(
      config.captions.bin,
      [
        audioPath,
        "--model",
        config.captions.model,
        "--task",
        "transcribe",
        "--output_format",
        "vtt",
        "--output_dir",
        outDir,
        // CPU has no fp16; passing this avoids a noisy per-run warning.
        "--fp16",
        "False",
      ],
      { env: whisperEnv() }
    );

    const files = await readdir(outDir);
    const vtt = files.find((f) => f.toLowerCase().endsWith(".vtt"));
    if (!vtt) {
      log.warn("whisper ran but produced no .vtt — skipping captions");
      return null;
    }
    log.info("captions generated", { file: vtt });
    // Language detection output isn't parsed for the MVP; label as English.
    return { vttPath: join(outDir, vtt), language: "en" };
  } catch (err) {
    // Keep the tail of stderr — that's where whisper reports the real cause.
    log.warn("caption generation unavailable — continuing without captions", {
      reason: err instanceof Error ? err.message.slice(-600) : String(err),
    });
    return null;
  }
}
