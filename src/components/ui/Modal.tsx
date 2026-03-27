"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  full: "max-w-4xl",
};

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  className,
}: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div
        className={cn(
          "relative w-full",
          "bg-surface-900 border border-surface-700/60 rounded-2xl shadow-2xl shadow-black/60",
          "ring-1 ring-inset ring-white/[0.05]",
          "animate-slide-up",
          "max-h-[90vh] overflow-y-auto",
          sizeClasses[size],
          className
        )}
      >
        {/* Subtle gradient top edge */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent rounded-t-2xl pointer-events-none" />

        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between px-6 pt-6 pb-4">
            <div>
              {title && (
                <h2 className="text-base font-bold tracking-tight text-surface-50">{title}</h2>
              )}
              {description && (
                <p className="text-sm text-surface-500 mt-0.5">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-surface-500 hover:text-surface-200 hover:bg-surface-700/80 p-1.5 rounded-lg transition-all ml-4 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className={cn(!title && !description ? "p-6" : "px-6 pb-6")}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "danger",
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center space-y-5">
        <div
          className={cn(
            "w-12 h-12 rounded-2xl mx-auto flex items-center justify-center",
            variant === "danger"
              ? "bg-red-500/15 border border-red-500/25"
              : "bg-primary-500/15 border border-primary-500/25"
          )}
        >
          <span className={cn("text-2xl", variant === "danger" ? "text-red-400" : "text-primary-400")}>
            {variant === "danger" ? "⚠" : "✓"}
          </span>
        </div>
        <div>
          <h3 className="text-base font-bold tracking-tight text-surface-50">{title}</h3>
          {description && (
            <p className="text-sm text-surface-400 mt-1.5 leading-relaxed">{description}</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm font-medium transition-all border border-surface-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50",
              variant === "danger"
                ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-900/30"
                : "bg-primary-600 hover:bg-primary-500 shadow-lg shadow-primary-900/30"
            )}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
