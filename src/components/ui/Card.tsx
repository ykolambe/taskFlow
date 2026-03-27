import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  padding?: "none" | "sm" | "md" | "lg";
}

export default function Card({ children, className, hover, onClick, padding = "md" }: CardProps) {
  const paddings = { none: "", sm: "p-4", md: "p-5", lg: "p-6" };

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-surface-800/70 border border-surface-700/50 rounded-2xl shadow-lg shadow-black/20 backdrop-blur-sm",
        hover &&
          "hover:border-primary-500/30 hover:shadow-primary-900/20 hover:bg-surface-800 transition-all duration-200 cursor-pointer",
        onClick && "cursor-pointer",
        paddings[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = "primary",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color?: "primary" | "success" | "warning" | "danger" | "info";
}) {
  const colorClasses = {
    primary: {
      badge: "bg-primary-500/10 text-primary-300 border border-primary-500/20",
      glow: "bg-primary-500/5",
      border: "border-primary-500/20",
    },
    success: {
      badge: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
      glow: "bg-emerald-500/5",
      border: "border-emerald-500/20",
    },
    warning: {
      badge: "bg-amber-500/10 text-amber-300 border border-amber-500/20",
      glow: "bg-amber-500/5",
      border: "border-amber-500/20",
    },
    danger: {
      badge: "bg-red-500/10 text-red-300 border border-red-500/20",
      glow: "bg-red-500/5",
      border: "border-red-500/20",
    },
    info: {
      badge: "bg-sky-500/10 text-sky-300 border border-sky-500/20",
      glow: "bg-sky-500/5",
      border: "border-sky-500/20",
    },
  };

  const c = colorClasses[color];

  return (
    <Card className={cn("relative overflow-hidden border", c.border)}>
      {/* Subtle glow corner */}
      <div
        className={cn(
          "absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl opacity-60 pointer-events-none",
          c.glow
        )}
      />
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] font-bold text-surface-500 uppercase tracking-widest">{title}</p>
          <p className="text-3xl font-extrabold text-surface-50 mt-1.5 tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-surface-500 mt-1">{subtitle}</p>}
          {trend && (
            <p
              className={cn(
                "text-xs mt-2 font-semibold inline-flex items-center gap-0.5",
                trend.value >= 0 ? "text-emerald-400" : "text-red-400"
              )}
            >
              {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={cn("p-2.5 rounded-xl shrink-0", c.badge)}>{icon}</div>
      </div>
    </Card>
  );
}
