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
import type { Readable } from "node:stream";
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

// HLS output layout (worker → player). Master references per-rung playlists,
// each of which lives in its own folder alongside its .ts segments.
export function hlsPrefix(videoId: string): string {
  return `videos/${videoId}/hls`;
}
export function hlsMasterKey(videoId: string): string {
  return `${hlsPrefix(videoId)}/master.m3u8`;
}
export function hlsVariantKey(videoId: string, label: string): string {
  return `${hlsPrefix(videoId)}/${label}/index.m3u8`;
}
export function thumbnailKey(videoId: string): string {
  return `videos/${videoId}/thumbnail.jpg`;
}
export function captionKey(videoId: string, language: string): string {
  return `videos/${videoId}/captions/${language}.vtt`;
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

// Fetch an object's body as a Node Readable stream (worker: download source).
export async function getObjectStream(key: string): Promise<Readable> {
  const out = await s3().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key })
  );
  return out.Body as Readable;
}

export interface ObjectResponse {
  body: Readable;
  contentType?: string;
  contentLength?: number;
  contentRange?: string;
  // 206 when a Range was requested and honored, else 200.
  status: 200 | 206;
}

// Fetch an object, optionally honoring an HTTP Range header (needed so the
// player-page proxy (Step 5) supports seeking within .ts segments / progressive
// files). Returns the raw body stream plus the headers to pass back through.
export async function getObjectRange(
  key: string,
  range?: string
): Promise<ObjectResponse> {
  const out = await s3().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key, Range: range })
  );
  return {
    body: out.Body as Readable,
    contentType: out.ContentType,
    contentLength: out.ContentLength,
    contentRange: out.ContentRange,
    status: out.ContentRange ? 206 : 200,
  };
}

// Upload a rendition/playlist/thumbnail artifact (worker: push outputs).
export async function putObject(
  key: string,
  body: Buffer | Readable | Uint8Array | string,
  contentType: string
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export { GetObjectCommand, PutObjectCommand };
