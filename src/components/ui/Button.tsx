"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]";

    const variants = {
      primary:
        "bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 text-white shadow-lg shadow-primary-900/40 border border-primary-400/30",
      secondary:
        "bg-surface-750/80 hover:bg-surface-700 text-surface-100 border border-surface-600/80 shadow-sm",
      ghost: "hover:bg-surface-700/60 text-surface-300 hover:text-surface-100",
      danger:
        "bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30",
      outline:
        "border border-surface-600 hover:border-primary-500/60 text-surface-300 hover:text-primary-300 bg-transparent",
    };

    const sizes = {
      sm: "px-3.5 py-1.5 text-xs gap-1.5",
      md: "px-5 py-2.5 text-sm",
      lg: "px-7 py-3.5 text-sm",
      icon: "p-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
