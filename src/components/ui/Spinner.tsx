import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export default function Spinner({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" };
  return <Loader2 className={cn("animate-spin text-primary-400", sizes[size], className)} />;
}

export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-surface-700" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
      </div>
      <p className="text-sm text-surface-400">Loading...</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-4">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-surface-800 border border-surface-700 flex items-center justify-center text-surface-500 text-2xl">
          {icon}
        </div>
      )}
      <div>
        <h3 className="text-base font-semibold text-surface-300">{title}</h3>
        {description && <p className="text-sm text-surface-500 mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}
