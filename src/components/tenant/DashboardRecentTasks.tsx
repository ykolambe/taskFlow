"use client";

import { useState, useEffect } from "react";
import { CheckSquare, Plus, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { Task } from "@/types";
import { TenantTokenPayload } from "@/lib/auth";
import DashboardTaskRow from "@/components/tenant/DashboardTaskRow";
import toast from "react-hot-toast";

interface Props {
  slug: string;
  user: TenantTokenPayload;
  initialTasks: Task[];
  pageSize: number;
  initialHasMore: boolean;
}

export default function DashboardRecentTasks({ slug, user, initialTasks, pageSize, initialHasMore }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTasks(initialTasks);
    setHasMore(initialHasMore);
  }, [initialTasks, initialHasMore]);

  const loadMore = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/t/${slug}/tasks?mineOnly=true&skip=${tasks.length}&take=${pageSize}`
      );
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Could not load more");
        return;
      }
      const next: Task[] = j.data ?? [];
      setTasks((prev) => [...prev, ...next]);
      setHasMore(Boolean(j.meta?.hasMore));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700">
        <h2 className="font-semibold text-surface-100 flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-primary-400" />
          My Tasks
        </h2>
        <div className="flex items-center gap-2">
          <Link
            href={`/t/${slug}/tasks`}
            className="text-xs text-surface-400 hover:text-surface-200 flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
          <Link href={`/t/${slug}/tasks?new=1`}>
            <button
              type="button"
              className="w-7 h-7 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded-lg flex items-center justify-center transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="py-12 text-center">
          <CheckSquare className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 text-sm font-medium">No active tasks</p>
          <p className="text-surface-600 text-xs mt-1">Create a task to get started</p>
          <Link href={`/t/${slug}/tasks?new=1`}>
            <button
              type="button"
              className="mt-3 text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 mx-auto transition-colors"
            >
              <Plus className="w-3 h-3" /> Create task
            </button>
          </Link>
        </div>
      ) : (
        <>
          <div className="divide-y divide-surface-700/50">
            {tasks.map((task) => (
              <DashboardTaskRow key={task.id} task={task} slug={slug} currentUserLevel={user.level} />
            ))}
          </div>
          {hasMore && (
            <div className="px-5 py-3 border-t border-surface-700/50 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="text-xs font-medium text-primary-400 hover:text-primary-300 inline-flex items-center gap-2 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
