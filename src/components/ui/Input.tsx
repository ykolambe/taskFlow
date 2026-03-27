"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-semibold uppercase tracking-widest text-surface-400 select-none">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full bg-surface-900/80 border border-surface-700/80 rounded-xl px-4 py-2.5 text-sm text-surface-100 placeholder:text-surface-600 caret-primary-400",
              "focus:outline-none focus:border-primary-500/70 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200",
              "hover:border-surface-600 disabled:opacity-50 disabled:cursor-not-allowed",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error && "border-red-500/60 focus:border-red-500 focus:ring-red-500/20",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-500">
              {rightIcon}
            </div>
          )}
        </div>
        {hint && !error && <p className="text-[11px] text-surface-600">{hint}</p>}
        {error && <p className="text-[11px] text-red-400 flex items-center gap-1">⚠ {error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

interface SelectProps {
  label?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  name?: string;
  required?: boolean;
}

export function Select({ label, error, children, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold uppercase tracking-widest text-surface-400 select-none">
          {label}
        </label>
      )}
      <select
        className={cn(
          "w-full bg-surface-900/80 border border-surface-700/80 rounded-xl px-4 py-2.5 text-sm text-surface-100",
          "focus:outline-none focus:border-primary-500/70 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200",
          "hover:border-surface-600 disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-red-500/60",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-[11px] text-red-400 flex items-center gap-1">⚠ {error}</p>}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-semibold uppercase tracking-widest text-surface-400 select-none">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          rows={3}
          className={cn(
            "w-full bg-surface-900/80 border border-surface-700/80 rounded-xl px-4 py-2.5 text-sm text-surface-100 placeholder:text-surface-600 caret-primary-400 resize-none",
            "focus:outline-none focus:border-primary-500/70 focus:ring-2 focus:ring-primary-500/20 transition-all duration-200",
            "hover:border-surface-600",
            error && "border-red-500/60",
            className
          )}
          {...props}
        />
        {error && <p className="text-[11px] text-red-400 flex items-center gap-1">⚠ {error}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
