import { readFile } from "fs/promises";
import path from "path";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] ?? "application/octet-stream";
}

/**
 * Read a file from `public/<folder>/...` with path traversal protection.
 * Used by route handlers so uploads work even when the default `public/` static
 * pipeline misbehaves (middleware order, caching) on some deployments.
 */
export async function readPublicUploadFile(
  folder: "attachments" | "logos" | "avatars" | "uploads",
  segments: string[]
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!segments?.length) return null;
  if (segments.some((s) => s.includes("..") || s === "")) return null;
  const root = path.resolve(process.cwd(), "public", folder);
  const abs = path.resolve(root, ...segments);
  const rel = path.relative(root, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  try {
    const buffer = await readFile(abs);
    return { buffer, contentType: contentTypeFor(abs) };
  } catch {
    return null;
  }
}
