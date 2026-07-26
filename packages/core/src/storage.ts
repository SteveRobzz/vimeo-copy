import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageEnv } from "./env";

// Lazy singleton so importing this module never throws before env is set.
let _client: S3Client | undefined;
export function s3(): S3Client {
  if (_client) return _client;
  const env = storageEnv();
  _client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

export function bucket(): string {
  return storageEnv().S3_BUCKET;
}

// Object-key layout. All artifacts for a video live under videos/<id>/.
export function sourceKey(videoId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `videos/${videoId}/source/${safe}`;
}

export interface UploadedPart {
  PartNumber: number;
  ETag: string;
}

export async function createMultipartUpload(
  key: string,
  contentType: string
): Promise<string> {
  const out = await s3().send(
    new CreateMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
    })
  );
  if (!out.UploadId) throw new Error("MinIO/S3 did not return an UploadId");
  return out.UploadId;
}

export async function signUploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 3600
): Promise<string> {
  return getSignedUrl(
    s3(),
    new UploadPartCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn }
  );
}

export async function listParts(key: string, uploadId: string) {
  const out = await s3().send(
    new ListPartsCommand({ Bucket: bucket(), Key: key, UploadId: uploadId })
  );
  return (out.Parts ?? []).map((p) => ({
    PartNumber: p.PartNumber!,
    ETag: p.ETag!,
    Size: p.Size,
  }));
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: UploadedPart[]
): Promise<void> {
  await s3().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: [...parts].sort((a, b) => a.PartNumber - b.PartNumber),
      },
    })
  );
}

export async function abortMultipartUpload(
  key: string,
  uploadId: string
): Promise<void> {
  await s3().send(
    new AbortMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
    })
  );
}

// Used by the worker (Step 4) to pull the source and push renditions.
export async function signGetUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn }
  );
}

export { GetObjectCommand, PutObjectCommand };
