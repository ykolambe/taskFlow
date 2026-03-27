"use client";

import { cn, getInitials } from "@/lib/utils";

interface AvatarProps {
  firstName: string;
  lastName: string;
  email?: string | null;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  color?: string;
  className?: string;
}

const sizeClasses = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-xl",
};

// Generate deterministic color from name
function getAvatarColor(name: string): string {
  const colors = [
    "from-violet-500 to-purple-600",
    "from-blue-500 to-indigo-600",
    "from-cyan-500 to-blue-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-pink-600",
    "from-indigo-500 to-blue-600",
    "from-teal-500 to-emerald-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function Avatar({
  firstName,
  lastName,
  email,
  avatarUrl,
  size = "md",
  className,
}: AvatarProps) {
  const initials = getInitials(firstName, lastName, email);
  const gradient = getAvatarColor((firstName ?? "") + (lastName ?? "") + (email ?? ""));
  const sizeClass = sizeClasses[size];

  if (avatarUrl && avatarUrl.trim() !== "") {
    return (
      <div
        className={cn(
          "rounded-full overflow-hidden flex-shrink-0 bg-surface-800 ring-1 ring-surface-700/50",
          sizeClass,
          className
        )}
      >
        {/* Plain img — no onError→initials swap (that caused photo → letter flash in dev / HMR). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={avatarUrl}
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover select-none"
          draggable={false}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-bold text-white flex-shrink-0 bg-gradient-to-br",
        gradient,
        sizeClass,
        className
      )}
    >
      {initials}
    </div>
  );
}

export function AvatarGroup({
  users,
  max = 3,
  size = "sm",
}: {
  users: Array<{ firstName: string; lastName: string; avatarUrl?: string | null }>;
  max?: number;
  size?: "xs" | "sm" | "md";
}) {
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((user, i) => (
        <div key={i} className="ring-2 ring-surface-800 rounded-full">
          <Avatar
            firstName={user.firstName}
            lastName={user.lastName}
            avatarUrl={user.avatarUrl}
            size={size}
          />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-surface-600 text-surface-300 font-medium ring-2 ring-surface-800 flex-shrink-0",
            sizeClasses[size],
            "text-[10px]"
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
