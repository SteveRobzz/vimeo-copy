import { Queue } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES } from "./index";
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

export { Queue };
