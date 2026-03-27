/**
 * Storage abstraction — supports local filesystem OR S3-compatible storage
 * (AWS S3, DigitalOcean Spaces, Cloudflare R2, MinIO, etc.)
 *
 * Set STORAGE_PROVIDER=s3 in .env to use S3/Spaces.
 * Leave unset or set to "local" for local disk storage.
 */

import { v4 as uuidv4 } from "uuid";

export const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_AVATAR_SIZE = 3 * 1024 * 1024; // 3 MB
export const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5 MB — org branding

export interface UploadResult {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  key: string; // storage key / path (useful for deletion)
}

function getStorageProvider(): "local" | "s3" {
  return (process.env.STORAGE_PROVIDER as "local" | "s3") ?? "local";
}

// ─── Local Storage ────────────────────────────────────────────────────────────

async function uploadLocal(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folder = "uploads"
): Promise<UploadResult> {
  const { writeFile, mkdir } = await import("fs/promises");
  const path = await import("path");

  const ext = originalName.split(".").pop() ?? "bin";
  const filename = `${uuidv4()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", folder);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);

  return {
    url: `/${folder}/${filename}`,
    fileName: originalName,
    fileSize: buffer.length,
    mimeType,
    key: `${folder}/${filename}`,
  };
}

// ─── S3 / Spaces Storage ──────────────────────────────────────────────────────

async function uploadS3(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folder = "uploads"
): Promise<UploadResult> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION ?? "us-east-1";
  const endpoint = process.env.S3_ENDPOINT; // optional — for DO Spaces / MinIO
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const publicBaseUrl = process.env.S3_PUBLIC_URL; // e.g. https://bucket.region.cdn.digitaloceanspaces.com

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY in .env");
  }

  const s3 = new S3Client({
    region,
    ...(endpoint && { endpoint }),
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: !!endpoint, // required for MinIO / custom endpoints
  });

  const ext = originalName.split(".").pop() ?? "bin";
  const key = `${folder}/${uuidv4()}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ACL: "public-read",
    })
  );

  const base = publicBaseUrl
    ? publicBaseUrl.replace(/\/$/, "")
    : `https://${bucket}.s3.${region}.amazonaws.com`;

  return {
    url: `${base}/${key}`,
    fileName: originalName,
    fileSize: buffer.length,
    mimeType,
    key,
  };
}

// ─── Delete (S3 only — local files persist) ───────────────────────────────────

export async function deleteFile(key: string): Promise<void> {
  if (getStorageProvider() !== "s3") return; // local: skip

  const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const bucket = process.env.S3_BUCKET!;
  const region = process.env.S3_REGION ?? "us-east-1";
  const endpoint = process.env.S3_ENDPOINT;

  const s3 = new S3Client({
    region,
    ...(endpoint && { endpoint }),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: !!endpoint,
  });

  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folder = "uploads"
): Promise<UploadResult> {
  if (getStorageProvider() === "s3") {
    return uploadS3(buffer, originalName, mimeType, folder);
  }
  return uploadLocal(buffer, originalName, mimeType, folder);
}

export function getStorageInfo(): { provider: string; configured: boolean } {
  const provider = getStorageProvider();
  const configured =
    provider === "local" ||
    !!(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
  return { provider, configured };
}
