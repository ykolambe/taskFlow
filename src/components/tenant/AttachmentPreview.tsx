"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, File, Image as ImageIcon, Maximize2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function isImageMimeType(mime: string | null | undefined): boolean {
  return !!mime?.startsWith("image/");
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="w-8 h-8 text-blue-400" />;
  if (mimeType === "application/pdf") return <FileText className="w-8 h-8 text-red-400" />;
  return <File className="w-8 h-8 text-surface-400" />;
}

type AttachmentPreviewRowProps = {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  /** Show remove control */
  showRemove?: boolean;
  onRemove?: () => void;
  /** Compact row (e.g. inbox lists) */
  compact?: boolean;
  className?: string;
};

/**
 * Task / ticket attachment row: image thumbnail + preview lightbox, open in new tab, optional remove.
 */
export function AttachmentPreviewRow({
  fileUrl,
  fileName,
  fileSize,
  mimeType,
  showRemove,
  onRemove,
  compact,
  className,
}: AttachmentPreviewRowProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isImg = isImageMimeType(mimeType);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  useEffect(() => {
    if (lightboxOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [lightboxOpen]);

  return (
    <>
      <div
        className={cn(
          "flex gap-3 bg-surface-750 rounded-xl px-3 py-2.5 group border border-transparent",
          compact && "py-2",
          className
        )}
      >
        {isImg ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className={cn(
              "relative flex-shrink-0 rounded-lg overflow-hidden border border-surface-600 bg-surface-900",
              "focus:outline-none focus:ring-2 focus:ring-primary-500/50",
              compact ? "h-14 w-14" : "h-20 w-20"
            )}
            title="Preview image"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileUrl}
              alt=""
              className="h-full w-full object-contain"
              loading="lazy"
            />
            <span
              className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              aria-hidden
            >
              <Maximize2 className="w-5 h-5 text-white drop-shadow-md" />
            </span>
          </button>
        ) : (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex-shrink-0 flex items-center justify-center rounded-lg border border-surface-600 bg-surface-900/80 p-2 hover:border-surface-500 transition-colors",
              compact ? "h-14 w-14" : "h-20 w-20"
            )}
            title="Open file"
          >
            <FileTypeIcon mimeType={mimeType} />
          </a>
        )}

        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-surface-200 hover:text-primary-400 truncate transition-colors"
          >
            {fileName}
          </a>
          <p className="text-[10px] text-surface-500">{formatBytes(fileSize)}</p>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            {isImg && (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="text-[10px] font-medium text-primary-400 hover:text-primary-300 inline-flex items-center gap-1"
              >
                <Maximize2 className="w-3 h-3" />
                Preview
              </button>
            )}
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-surface-400 hover:text-surface-200 inline-flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Open
            </a>
          </div>
        </div>

        {showRemove && onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className={cn(
              "self-start text-surface-500 hover:text-red-400 transition-colors p-1 flex-shrink-0",
              !compact && "opacity-0 group-hover:opacity-100"
            )}
            title="Remove"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isImg && lightboxOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
          <button
            type="button"
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            aria-label="Close preview"
            onClick={() => setLightboxOpen(false)}
          />
          <div
            className="relative z-[101] max-w-[min(100vw-2rem,1200px)] max-h-[90vh] w-full flex flex-col gap-4 rounded-2xl border border-surface-700 bg-surface-900 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-surface-100 truncate pr-8">{fileName}</p>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="flex-shrink-0 rounded-lg p-1.5 text-surface-400 hover:text-surface-100 hover:bg-surface-800"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileUrl}
              alt={fileName}
              className="max-h-[min(75vh,800px)] w-full object-contain rounded-lg bg-black/20"
            />
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open in new tab
              </a>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="rounded-xl border border-surface-600 px-4 py-2 text-sm text-surface-300 hover:bg-surface-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
