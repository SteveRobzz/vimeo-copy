import { z } from "zod";

// Storage config. Names are generic (S3_*) so MinIO (local) and Cloudflare R2
// (prod) both slot in without code changes — only env values differ.
const StorageEnv = z.object({
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  // MinIO needs path-style URLs; R2 works with either. Parsed from a string.
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export type StorageEnv = z.infer<typeof StorageEnv>;

let _storageEnv: StorageEnv | undefined;
export function storageEnv(): StorageEnv {
  if (!_storageEnv) _storageEnv = StorageEnv.parse(process.env);
  return _storageEnv;
}

const RedisEnv = z.object({
  REDIS_URL: z.string().min(1),
});

let _redisEnv: z.infer<typeof RedisEnv> | undefined;
export function redisEnv() {
  if (!_redisEnv) _redisEnv = RedisEnv.parse(process.env);
  return _redisEnv;
}
