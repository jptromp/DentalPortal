import "server-only";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListPartsCommand,
  S3Client,
  UploadPartCommand,
  type Part,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 via its S3-compatible API. The bucket is private; clients only
// ever receive short-lived presigned URLs.
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } =
  process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  throw new Error("R2 storage environment variables are not set");
}

export const bucket = R2_BUCKET;

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

// RFC 6266: ASCII fallback plus the exact UTF-8 name.
function contentDisposition(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function createDownloadUrl(key: string, downloadName?: string) {
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: downloadName
        ? contentDisposition(downloadName)
        : undefined,
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );
}

// Large files go straight from the browser to R2 in parts, so they never pass
// through the web server. ETags are read back server-side with ListParts,
// which also lets an interrupted upload resume where it stopped.

export async function startMultipartUpload(key: string, contentType: string) {
  const result = await r2.send(
    new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
  );
  if (!result.UploadId) throw new Error("R2 did not return an upload id");
  return result.UploadId;
}

export function createPartUploadUrl(key: string, uploadId: string, partNumber: number) {
  return getSignedUrl(
    r2,
    new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );
}

export async function listUploadedParts(key: string, uploadId: string) {
  const parts: Part[] = [];
  let marker: string | undefined;
  do {
    const page = await r2.send(
      new ListPartsCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker }),
    );
    parts.push(...(page.Parts ?? []));
    marker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
  } while (marker);
  return parts;
}

export async function completeMultipartUpload(key: string, uploadId: string, parts: Part[]) {
  await r2.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag }))
          .sort((a, b) => a.PartNumber! - b.PartNumber!),
      },
    }),
  );
}

export async function abortMultipartUpload(key: string, uploadId: string) {
  try {
    await r2.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
  } catch {
    // Already completed or aborted.
  }
}

export async function getObjectSize(key: string) {
  const head = await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return head.ContentLength ?? 0;
}

// Reads the first bytes of an object, for file-type checks.
export async function readObjectStart(key: string, length: number) {
  const result = await r2.send(
    new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${length - 1}` }),
  );
  return result.Body ? await result.Body.transformToByteArray() : new Uint8Array();
}

export async function deleteObject(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function checkStorage() {
  await r2.send(new HeadBucketCommand({ Bucket: bucket }));
}
