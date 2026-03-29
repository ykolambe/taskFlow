import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import {
  uploadFile,
  ALLOWED_TYPES,
  AVATAR_TYPES,
  MAX_SIZE,
  MAX_AVATAR_SIZE,
  MAX_LOGO_SIZE,
} from "@/lib/storage";

/**
 * POST /api/upload
 * Query params:
 *   ?slug=...     — required: tenant slug; must match authenticated tenant session
 *   ?type=logo    — images only, 5MB, "logos" folder, super admin only
 *   ?type=avatar  — images only, 3MB, "avatars" folder
 *   ?type=attachment — allowed doc/image types, 10MB, "attachments" folder
 *   ?type=chat       — images + MP4/WebM/MOV video, 25MB, "chat-media" folder
 *   (default)     — same as attachment bucket (10MB, "attachments")
 */
export async function POST(req: NextRequest) {
  const uploadType = req.nextUrl.searchParams.get("type") ?? "general";
  const slug = req.nextUrl.searchParams.get("slug");

  if (!slug || !slug.trim()) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const viewer = await getTenantUser(slug.trim());
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (uploadType === "logo" && !viewer.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    let allowedTypes: readonly string[];
    let maxSize: number;
    let folder: string;
    let typeError: string;
    let sizeError: string;

    if (uploadType === "logo") {
      allowedTypes = AVATAR_TYPES;
      maxSize = MAX_LOGO_SIZE;
      folder = "logos";
      typeError = "Logo must be a JPEG, PNG, GIF, or WebP image";
      sizeError = "Logo must be under 5 MB";
    } else if (uploadType === "avatar") {
      allowedTypes = AVATAR_TYPES;
      maxSize = MAX_AVATAR_SIZE;
      folder = "avatars";
      typeError = "Avatar must be a JPEG, PNG, GIF, or WebP image";
      sizeError = "Avatar must be under 3 MB";
    } else if (uploadType === "chat") {
      allowedTypes = [
        ...AVATAR_TYPES,
        "video/mp4",
        "video/webm",
        "video/quicktime",
      ];
      maxSize = 25 * 1024 * 1024;
      folder = "chat-media";
      typeError = "Use JPEG, PNG, GIF, WebP, MP4, WebM, or MOV";
      sizeError = "Each file must be under 25 MB";
    } else {
      allowedTypes = ALLOWED_TYPES;
      maxSize = MAX_SIZE;
      folder = "attachments";
      typeError = "File type not allowed";
      sizeError = "File must be under 10 MB";
    }

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: typeError }, { status: 400 });
    }

    if (file.size > maxSize) {
      return NextResponse.json({ error: sizeError }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await uploadFile(buffer, file.name, file.type, folder);

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[upload]", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
