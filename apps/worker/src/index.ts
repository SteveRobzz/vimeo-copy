import { config } from "./config";
import { transcodeWorker, redisConnection } from "@vp/core/queue";
import { prisma } from "@vp/db";
import { runTranscode } from "./pipeline";
import { log } from "./logger";

// BullMQ consumer for the `transcode` queue. Each job: probe → ladder → HLS →
// thumbnail → captions, updating the Video row as it goes. Failures flip the
// Video to ERROR (with the message) so the UI can surface it; BullMQ still
// retries per the attempts/backoff set by the producer.
const worker = transcodeWorker(
  async (job) => {
    log.info("job started", { jobId: job.id, attempt: job.attemptsMade + 1 });
    await runTranscode(job.data);
  },
  { concurrency: config.concurrency }
);

worker.on("completed", (job) => {
  log.info("job completed", { jobId: job.id });
});

worker.on("failed", async (job, err) => {
  log.error("job failed", { jobId: job?.id, error: err.message });
  if (!job) return;
  // On the final attempt, persist the error so the dashboard/UI can show it.
  const isFinal = job.attemptsMade >= (job.opts.attempts ?? 1);
  if (isFinal) {
    await prisma.video
      .update({
        where: { id: job.data.videoId },
        data: { status: "ERROR", errorMessage: err.message.slice(0, 500) },
      })
      .catch((e) => log.error("could not persist ERROR state", { error: String(e) }));
  }
});

log.info("transcode worker up", {
  concurrency: config.concurrency,
  preset: config.preset,
  captions: config.captions.enabled,
});

async function shutdown(signal: string) {
  log.info("shutting down", { signal });
  await worker.close();
  await redisConnection().quit().catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
