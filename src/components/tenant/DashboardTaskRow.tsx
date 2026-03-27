"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import { Task } from "@/types";
import { formatDate, isOverdue } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function DashboardTaskRow({
  task,
  slug,
  highlight,
  currentUserLevel,
}: {
  task: Task;
  slug: string;
  highlight?: string;
  currentUserLevel?: number;
}) {
  const overdue = isOverdue(task.dueDate) && task.status !== "COMPLETED";
  const isFromUpperLevel =
    currentUserLevel !== undefined &&
    task.creator.roleLevel.level < currentUserLevel &&
    task.creatorId !== task.assigneeId;
  const creatorColor = task.creator.roleLevel.color;

  return (
    <Link href={`/t/${slug}/tasks?task=${task.id}`}>
      <div
        className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-750 transition-colors group border-l-4"
        style={{
          borderLeftColor: overdue ? "#ef4444" : isFromUpperLevel ? creatorColor : "transparent",
        }}
      >
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium truncate",
              overdue ? "text-red-400" : "text-surface-200 group-hover:text-surface-100"
            )}
          >
            {task.title}
          </p>
          {isFromUpperLevel && (
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: creatorColor }} />
              <span className="text-[10px] font-semibold" style={{ color: creatorColor }}>
                {task.creator.roleLevel.name} · {task.creator.firstName} {task.creator.lastName}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.dueDate && (
              <span className={cn("text-xs", overdue ? "text-red-400" : "text-surface-500")}>
                {overdue ? "⚠ Overdue: " : "Due: "}
                {formatDate(task.dueDate)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Avatar
            firstName={task.assignee.firstName}
            lastName={task.assignee.lastName}
            avatarUrl={task.assignee.avatarUrl}
            size="xs"
          />
          <ArrowRight className="w-3.5 h-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
        </div>
      </div>
    </Link>
  );
}
