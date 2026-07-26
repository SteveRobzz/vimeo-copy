import { Queue, Worker, type Processor, type WorkerOptions } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES, type TranscodeJobData } from "./index";
import { redisEnv } from "./env";

// Shared Redis connection. maxRetriesPerRequest must be null for BullMQ.
let _connection: IORedis | undefined;
export function redisConnection(): IORedis {
  if (!_connection) {
    _connection = new IORedis(redisEnv().REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return _connection;
}

// Producer side (used by the web app to enqueue transcode jobs).
let _transcodeQueue: Queue | undefined;
export function transcodeQueue(): Queue {
  if (!_transcodeQueue) {
    _transcodeQueue = new Queue(QUEUE_NAMES.TRANSCODE, {
      connection: redisConnection(),
    });
  }
  return _transcodeQueue;
}

// Consumer side (used by the worker to process transcode jobs). Kept here so
// both sides share one queue name + connection config.
export function transcodeWorker(
  processor: Processor<TranscodeJobData>,
  opts: Partial<WorkerOptions> = {}
): Worker<TranscodeJobData> {
  return new Worker<TranscodeJobData>(QUEUE_NAMES.TRANSCODE, processor, {
    connection: redisConnection(),
    concurrency: 1,
    ...opts,
  });
}

export { Queue, Worker };
