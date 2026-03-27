import { cn } from "@/lib/utils";
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "primary" | "success" | "warning" | "danger" | "info";
}

export function Badge({ children, className, variant = "default" }: BadgeProps) {
  const variants = {
    default: "bg-surface-700/60 text-surface-400 border border-surface-700",
    primary: "bg-primary-500/15 text-primary-300 border border-primary-500/25",
    success: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
    warning: "bg-amber-500/15 text-amber-300 border border-amber-500/25",
    danger: "bg-red-500/15 text-red-300 border border-red-500/25",
    info: "bg-sky-500/15 text-sky-300 border border-sky-500/25",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full tracking-wide",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full tracking-wide",
        TASK_STATUS_COLORS[status] || "bg-surface-700/60 text-surface-400"
      )}
    >
      {TASK_STATUS_LABELS[status] || status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const dotColors: Record<string, string> = {
    LOW: "bg-emerald-400",
    MEDIUM: "bg-sky-400",
    HIGH: "bg-amber-400",
    URGENT: "bg-red-400 animate-pulse",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full tracking-wide",
        PRIORITY_COLORS[priority] || "bg-surface-700/60 text-surface-400"
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotColors[priority])} />
      {PRIORITY_LABELS[priority] || priority}
    </span>
  );
}

export function ApprovalBadge({ status }: { status: string }) {
  const configs: Record<string, { className: string; label: string }> = {
    PENDING: {
      className: "bg-amber-500/15 text-amber-300 border border-amber-500/25",
      label: "Pending",
    },
    APPROVED: {
      className: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
      label: "Approved",
    },
    REJECTED: {
      className: "bg-red-500/15 text-red-300 border border-red-500/25",
      label: "Rejected",
    },
  };
  const config = configs[status] || configs.PENDING;
  return (
    <span
      className={cn(
        "inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full tracking-wide",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
