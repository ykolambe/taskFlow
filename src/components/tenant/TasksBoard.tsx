"use client";

import { useState, useEffect, useRef } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Search, Archive, X, Paperclip, Calendar, Upload, FileText, Image, File, Trash2, LayoutList, Columns } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import Avatar from "@/components/ui/Avatar";
import { TenantTokenPayload } from "@/lib/auth";
import { Task, Priority, User as UserType } from "@/types";
import { formatDate, isOverdue, canCompleteTask, canManageAnyTaskStatus } from "@/lib/utils";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import TaskComments from "@/components/tenant/TaskComments";

export interface StatusConfig {
  id: string;
  key: string;
  label: string;
  color: string;
  order: number;
  type: "OPEN" | "ACTIVE" | "REVIEW" | "DONE";
}

// Fallback default statuses used when no configs are passed
const DEFAULT_STATUSES: StatusConfig[] = [
  { id: "TODO",             key: "TODO",             label: "To Do",            color: "#64748b", order: 1, type: "OPEN"   },
  { id: "IN_PROGRESS",      key: "IN_PROGRESS",      label: "In Progress",      color: "#3b82f6", order: 2, type: "ACTIVE" },
  { id: "READY_FOR_REVIEW", key: "READY_FOR_REVIEW", label: "Ready for Review", color: "#f59e0b", order: 3, type: "REVIEW" },
  { id: "COMPLETED",        key: "COMPLETED",        label: "Completed",        color: "#10b981", order: 4, type: "DONE"   },
];

interface Props {
  user: TenantTokenPayload;
  tasks: Task[];
  archivedTasks: Task[];
  canViewArchived: boolean;
  assignableUsers: UserType[];
  slug: string;
  taskStatuses?: StatusConfig[];
  initialTaskId?: string;
  openNew?: boolean;
}

export default function TasksBoard({ user, tasks: initialTasks, archivedTasks, canViewArchived, assignableUsers, slug, taskStatuses, initialTaskId, openNew }: Props) {
  const statusConfigs = taskStatuses?.length ? taskStatuses : DEFAULT_STATUSES;
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(
    initialTaskId ? (initialTasks.find((t) => t.id === initialTaskId) || null) : null
  );
  const [showNewTask, setShowNewTask] = useState(openNew || false);
  const [view, setView] = useState<"board" | "list">("list");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // New task form
  const [newTask, setNewTask] = useState({ title: "", description: "", assigneeId: user.userId, priority: "MEDIUM" as Priority, dueDate: "" });
  const [creating, setCreating] = useState(false);

  const doneKeys = statusConfigs.filter((s) => s.type === "DONE").map((s) => s.key);

  const filteredTasks = tasks.filter((t) => {
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q) ?? false;
      if (!matchTitle && !matchDesc) return false;
    }
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (filterAssignee !== "all" && t.assigneeId !== filterAssignee) return false;
    if (showOverdueOnly && (!t.dueDate || !isOverdue(t.dueDate) || doneKeys.includes(t.status))) return false;
    return true;
  });

  const myTasks = filteredTasks.filter((t) => t.assigneeId === user.userId);
  const teamTasks = filteredTasks.filter((t) => t.assigneeId !== user.userId);

  const toggleSelectTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const clearBulkSelection = () => {
    setSelectedTaskIds(new Set());
    setBulkMode(false);
  };

  const selectAllVisible = () => {
    setSelectedTaskIds(new Set(filteredTasks.map((t) => t.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.size === 0) return;
    if (!confirm(`Delete ${selectedTaskIds.size} selected task(s)?`)) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedTaskIds);
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/t/${slug}/tasks/${id}`, { method: "DELETE" }).then(async (res) => {
            if (!res.ok) {
              const j = await res.json().catch(() => null);
              throw new Error(j?.error || "Failed");
            }
            return id;
          })
        )
      );
      const okIds = results
        .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
        .map((r) => r.value);
      const failCount = results.length - okIds.length;

      if (okIds.length > 0) {
        const okSet = new Set(okIds);
        setTasks((prev) => prev.filter((t) => !okSet.has(t.id)));
      }
      setSelectedTaskIds(new Set());
      if (failCount === 0) {
        toast.success(`Deleted ${okIds.length} task(s)`);
        setBulkMode(false);
      } else {
        toast.error(`Deleted ${okIds.length}, failed ${failCount} (permission or missing task)`);
      }
      router.refresh();
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) { toast.error("Title is required"); return; }
    setCreating(true);
    try {
      const res = await fetch(`/api/t/${slug}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newTask, dueDate: newTask.dueDate || null }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to create task"); return; }
      setTasks([data.data, ...tasks]);
      setNewTask({ title: "", description: "", assigneeId: user.userId, priority: "MEDIUM", dueDate: "" });
      setShowNewTask(false);
      toast.success("Task created!");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (taskId: string, status: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const targetConfig = statusConfigs.find((s) => s.key === status);
    const currentConfig = statusConfigs.find((s) => s.key === task.status);
    const currentType = currentConfig?.type ?? "ACTIVE";
    const targetType = targetConfig?.type ?? "ACTIVE";
    const isDone = targetType === "DONE";

    const isAssignee = task.assigneeId === user.userId;
    const isCreator = task.creatorId === user.userId;
    const canComplete = isCreator || user.isSuperAdmin || canCompleteTask(user.level, task.creator.roleLevel?.level ?? 0);

    if (canManageAnyTaskStatus(user)) {
      // ok — super admin or top of org (level 1)
    } else if (isAssignee) {
      if (targetType === "DONE" || currentType === "DONE") {
        toast.error("Only a manager or admin can mark a task complete or incomplete");
        return;
      }
      if (targetType === "OPEN" && currentType !== "OPEN") {
        toast.error("Only a manager can move this task back to backlog");
        return;
      }
    } else {
      if (isDone && !canComplete) {
        toast.error("Only the task creator or higher level can mark as completed");
        return;
      }
      if (!canComplete) {
        toast.error("You don't have permission to change this task status");
        return;
      }
    }

    const res = await fetch(`/api/t/${slug}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const data = await res.json();
      setTasks(tasks.map((t) => (t.id === taskId ? data.data : t)));
      if (selectedTask?.id === taskId) setSelectedTask(data.data);
      if (isDone) {
        toast.success("Task completed! Moving to archive...");
        setTimeout(() => {
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
          if (selectedTask?.id === taskId) setSelectedTask(null);
          router.refresh();
        }, 1500);
      } else {
        toast.success("Status updated");
      }
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error || "Failed to update status");
    }
  };

  const getNextStatus = (currentKey: string, isAssignee: boolean, canComplete: boolean): string | null => {
    const idx = statusConfigs.findIndex((s) => s.key === currentKey);
    if (idx < 0 || idx >= statusConfigs.length - 1) return null;
    const next = statusConfigs[idx + 1];
    if (next.type === "DONE" && !canComplete) return null;
    if (!isAssignee && !canComplete) return null;
    return next.key;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-surface-800 bg-surface-900 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-surface-100">Tasks</h1>
            <p className="text-surface-400 text-xs mt-0.5">{filteredTasks.length} tasks visible</p>
          </div>
          <div className="flex items-center gap-2">
            {/* List / Kanban toggle */}
            {!showArchived && (
              <div className="flex items-center bg-surface-800 border border-surface-700 rounded-lg p-0.5">
                <button
                  onClick={() => setView("list")}
                  title="List view"
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                    view === "list"
                      ? "bg-surface-700 text-surface-100 shadow-sm"
                      : "text-surface-500 hover:text-surface-300"
                  )}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">List</span>
                </button>
                <button
                  onClick={() => setView("board")}
                  title="Kanban view"
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                    view === "board"
                      ? "bg-surface-700 text-surface-100 shadow-sm"
                      : "text-surface-500 hover:text-surface-300"
                  )}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Kanban</span>
                </button>
              </div>
            )}
            {canViewArchived && (
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={cn("p-2 rounded-lg text-sm transition-all", showArchived ? "bg-surface-700 text-surface-200" : "text-surface-500 hover:text-surface-300 hover:bg-surface-800")}
                title="View archived (upper levels only)"
              >
                <Archive className="w-4 h-4" />
              </button>
            )}
            {!showArchived && (
              <>
                <Button
                  size="sm"
                  variant={bulkMode ? "secondary" : "outline"}
                  onClick={() => {
                    if (bulkMode) clearBulkSelection();
                    else setBulkMode(true);
                  }}
                >
                  {bulkMode ? "Cancel Bulk" : "Bulk Select"}
                </Button>
                {bulkMode && (
                  <>
                    <Button size="sm" variant="secondary" onClick={selectAllVisible}>
                      Select All Visible
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                      loading={bulkDeleting}
                      onClick={handleBulkDelete}
                      disabled={selectedTaskIds.size === 0}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Selected ({selectedTaskIds.size})
                    </Button>
                  </>
                )}
              </>
            )}
            <Button onClick={() => setShowNewTask(true)} size="sm">
              <Plus className="w-4 h-4" /> New Task
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-2">
          {/* Row 1: search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
            <input
              placeholder="Search title or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg pl-9 pr-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500 transition-all"
            />
          </div>
          {/* Row 2: selects + overdue toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-xs text-surface-300 focus:outline-none focus:border-primary-500 transition-all"
            >
              <option value="all">All Status</option>
              {statusConfigs.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-xs text-surface-300 focus:outline-none focus:border-primary-500 transition-all"
            >
              <option value="all">All Priority</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-xs text-surface-300 focus:outline-none focus:border-primary-500 transition-all"
            >
              <option value="all">All Assignees</option>
              <option value={user.userId}>My Tasks</option>
              {assignableUsers.filter((u) => u.id !== user.userId).map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
            <button
              onClick={() => setShowOverdueOnly((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border",
                showOverdueOnly
                  ? "bg-red-500/20 text-red-400 border-red-500/40"
                  : "bg-surface-800 border-surface-700 text-surface-400 hover:text-surface-200"
              )}
            >
              ⚠ Overdue
            </button>
            {(search || filterStatus !== "all" || filterPriority !== "all" || filterAssignee !== "all" || showOverdueOnly) && (
              <button
                onClick={() => { setSearch(""); setFilterStatus("all"); setFilterPriority("all"); setFilterAssignee("all"); setShowOverdueOnly(false); }}
                className="text-xs text-surface-500 hover:text-surface-300 flex items-center gap-1 transition-colors ml-auto"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {showArchived ? (
          <ArchivedTaskList tasks={archivedTasks} />
        ) : view === "board" ? (
          <KanbanBoard
            tasks={filteredTasks}
            currentUser={user}
            statusConfigs={statusConfigs}
            onTaskClick={setSelectedTask}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <TaskList
            myTasks={myTasks}
            teamTasks={teamTasks}
            currentUser={user}
            statusConfigs={statusConfigs}
            onTaskClick={(task) => (bulkMode ? toggleSelectTask(task.id) : setSelectedTask(task))}
            onStatusChange={handleStatusChange}
            bulkMode={bulkMode}
            selectedTaskIds={selectedTaskIds}
            onToggleSelect={toggleSelectTask}
          />
        )}
      </div>

      {/* Task Detail Modal */}
      <Modal isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} size="lg" title={selectedTask?.title}>
        {selectedTask && (
          <TaskDetail
            task={selectedTask}
            user={user}
            slug={slug}
            statusConfigs={statusConfigs}
            onStatusChange={(status) => handleStatusChange(selectedTask.id, status)}
            onClose={() => setSelectedTask(null)}
            onTaskUpdate={(updated) => {
              setSelectedTask(updated);
              setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            }}
            onTaskDelete={(taskId) => {
              setTasks((prev) => prev.filter((t) => t.id !== taskId));
              setSelectedTask(null);
            }}
          />
        )}
      </Modal>

      {/* New Task Modal */}
      <Modal isOpen={showNewTask} onClose={() => setShowNewTask(false)} title="Create New Task" size="md">
        <div className="space-y-4">
          <Input
            label="Task Title"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            placeholder="What needs to be done?"
            autoFocus
          />
          <Textarea
            label="Description (optional)"
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            placeholder="Add details..."
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Priority"
              value={newTask.priority}
              onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Priority })}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
            <Input
              label="Due Date"
              type="date"
              value={newTask.dueDate}
              onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
            />
          </div>
          <Select
            label="Assign To"
            value={newTask.assigneeId}
            onChange={(e) => setNewTask({ ...newTask, assigneeId: e.target.value })}
          >
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} {u.id === user.userId ? "(me)" : ""} — {u.roleLevel?.name ?? "No Role"}
              </option>
            ))}
          </Select>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowNewTask(false)}>Cancel</Button>
            <Button className="flex-1" loading={creating} onClick={handleCreateTask}>Create Task</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TaskList({
  myTasks,
  teamTasks,
  currentUser,
  statusConfigs,
  onTaskClick,
  onStatusChange,
  bulkMode,
  selectedTaskIds,
  onToggleSelect,
}: {
  myTasks: Task[];
  teamTasks: Task[];
  currentUser: TenantTokenPayload;
  statusConfigs: StatusConfig[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (id: string, status: string) => void;
  bulkMode: boolean;
  selectedTaskIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* My Tasks */}
      <section>
        <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-3">
          My Tasks ({myTasks.length})
        </h2>
        {myTasks.length === 0 ? (
          <div className="py-8 text-center text-surface-600 text-sm">No tasks assigned to you</div>
        ) : (
          <div className="space-y-2">
            {myTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                currentUser={currentUser}
                statusConfigs={statusConfigs}
                onClick={() => onTaskClick(task)}
                onStatusChange={onStatusChange}
                bulkMode={bulkMode}
                isSelected={selectedTaskIds.has(task.id)}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </div>
        )}
      </section>

      {/* Team Tasks */}
      {teamTasks.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-3">
            Team Tasks ({teamTasks.length})
          </h2>
          <div className="space-y-2">
            {teamTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                currentUser={currentUser}
                statusConfigs={statusConfigs}
                onClick={() => onTaskClick(task)}
                onStatusChange={onStatusChange}
                bulkMode={bulkMode}
                isSelected={selectedTaskIds.has(task.id)}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Kanban Board ─────────────────────────────────────────────────────────────

function KanbanBoard({
  tasks,
  currentUser,
  statusConfigs,
  onTaskClick,
  onStatusChange,
}: {
  tasks: Task[];
  currentUser: TenantTokenPayload;
  statusConfigs: StatusConfig[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (!event.active) return;
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active || !over) return;

    const taskId = String(active.id);
    const targetStatusKey = String(over.id);

    // If dropped back into the same status, do nothing
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatusKey) {
      setActiveId(null);
      return;
    }

    onStatusChange(taskId, targetStatusKey);
    setActiveId(null);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 h-full overflow-x-auto pb-4 -mx-1 px-1">
        {statusConfigs.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          return (
            <KanbanColumn
              key={col.key}
              column={col}
              tasks={colTasks}
              currentUser={currentUser}
              statusConfigs={statusConfigs}
              onTaskClick={onTaskClick}
              onStatusChange={onStatusChange}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeId &&
          (() => {
            const task = tasks.find((t) => t.id === activeId);
            if (!task) return null;
            return (
              <div className="w-72 sm:w-80">
                <KanbanCard
                  task={task}
                  currentUser={currentUser}
                  statusConfigs={statusConfigs}
                  onClick={() => {}}
                  onStatusChange={() => {}}
                  isOverlay
                />
              </div>
            );
          })()}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  column,
  tasks,
  currentUser,
  statusConfigs,
  onTaskClick,
  onStatusChange,
}: {
  column: StatusConfig;
  tasks: Task[];
  currentUser: TenantTokenPayload;
  statusConfigs: StatusConfig[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-72 sm:w-80 flex flex-col bg-surface-900/60 border rounded-2xl transition-colors",
        isOver ? "border-primary-500/60 bg-primary-500/5" : "border-surface-800/60"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800/60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: column.color }}>
            {column.label}
          </span>
        </div>
        <span className="text-xs font-semibold text-surface-600 bg-surface-800 rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-xs text-surface-700 select-none">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              currentUser={currentUser}
              statusConfigs={statusConfigs}
              onClick={() => onTaskClick(task)}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  task,
  currentUser,
  statusConfigs,
  onClick,
  onStatusChange,
  isOverlay = false,
}: {
  task: Task;
  currentUser: TenantTokenPayload;
  statusConfigs: StatusConfig[];
  onClick: () => void;
  onStatusChange: (id: string, status: string) => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const doneKeys = statusConfigs.filter((s) => s.type === "DONE").map((s) => s.key);
  const overdue = isOverdue(task.dueDate) && !doneKeys.includes(task.status);
  const isAssignee = task.assigneeId === currentUser.userId;
  const isCreator = task.creatorId === currentUser.userId;
  const creatorLevel = task.creator.roleLevel?.level ?? 0;
  const canComplete = isCreator || currentUser.isSuperAdmin || canCompleteTask(currentUser.level, creatorLevel);
  const canMarkDone =
    canManageAnyTaskStatus(currentUser) ||
    (!isAssignee && (isCreator || currentUser.isSuperAdmin || canCompleteTask(currentUser.level, creatorLevel)));

  const isFromUpperLevel =
    task.creatorId !== currentUser.userId &&
    creatorLevel < currentUser.level;
  const creatorColor = task.creator.roleLevel?.color;

  const currentIdx = statusConfigs.findIndex((s) => s.key === task.status);
  const nextConfig = currentIdx >= 0 && currentIdx < statusConfigs.length - 1 ? statusConfigs[currentIdx + 1] : null;
  const canAdvance = nextConfig
    ? nextConfig.type === "DONE"
      ? canMarkDone
      : isAssignee || canComplete
    : false;
  const nextStatus = canAdvance ? nextConfig?.key ?? null : null;

  const dragStyle = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    opacity: isOverlay ? 0.95 : 1,
    zIndex: isOverlay || isDragging ? 50 : 1,
    position: "relative" as const,
  };

  const visualStyle =
    isFromUpperLevel && creatorColor && !overdue
      ? { borderLeftColor: creatorColor, backgroundColor: creatorColor + "0d" }
      : {};

  const style = { ...visualStyle, ...dragStyle };

  const mergedStyle =
    isFromUpperLevel && creatorColor && !overdue
      ? { borderLeftColor: creatorColor, backgroundColor: creatorColor + "0d", ...style }
      : { ...style };

  return (
    <div
      ref={setNodeRef}
      style={mergedStyle}
      onClick={onClick}
      className={cn(
        "group relative bg-surface-800 border rounded-xl p-3 cursor-pointer transition-all hover:border-surface-600 hover:shadow-md hover:shadow-black/20",
        overdue
          ? "border-red-500/40 bg-red-500/5"
          : isFromUpperLevel && creatorColor
          ? "border-l-2"
          : "border-surface-700/60"
      )}
    >
      {/* Title */}
      <p className={cn("text-sm font-semibold leading-snug line-clamp-2 mb-2", overdue ? "text-red-300" : "text-surface-100")}>
        {task.title}
      </p>

      {/* Upper-level badge */}
      {isFromUpperLevel && creatorColor && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: creatorColor }} />
          <span className="text-[10px] font-semibold truncate" style={{ color: creatorColor }}>
            {task.creator.roleLevel?.name ?? "Admin"} · {task.creator.firstName}
          </span>
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <PriorityBadge priority={task.priority} />
        {task.dueDate && (
          <span className={cn("text-[10px] flex items-center gap-0.5 font-medium", overdue ? "text-red-400" : "text-surface-600")}>
            <Calendar className="w-2.5 h-2.5" />
            {formatDate(task.dueDate)}
          </span>
        )}
        {(task.attachments?.length ?? 0) > 0 && (
          <span className="text-[10px] text-surface-600 flex items-center gap-0.5">
            <Paperclip className="w-2.5 h-2.5" />
            {task.attachments!.length}
          </span>
        )}
      </div>

      {/* Footer: avatar + advance button */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-surface-700/40">
        <Avatar
          firstName={task.assignee.firstName}
          lastName={task.assignee.lastName}
          avatarUrl={task.assignee.avatarUrl}
          size="xs"
        />
        {nextStatus && nextConfig && (
          <button
            onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, nextStatus); }}
            className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold bg-primary-500/20 text-primary-300 border border-primary-500/30 px-2 py-0.5 rounded-lg hover:bg-primary-500/30 transition-all"
          >
            → {nextConfig.label.split(" ")[0]}
          </button>
        )}
        {!isOverlay && (
          <button
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()}
            className="ml-2 text-surface-600 hover:text-surface-300 cursor-grab active:cursor-grabbing"
            title="Drag to another column"
          >
            ⋮⋮
          </button>
        )}
      </div>
    </div>
  );
}

// ── List Task Card ────────────────────────────────────────────────────────────

function TaskCard({
  task,
  currentUser,
  statusConfigs,
  onClick,
  onStatusChange,
  bulkMode = false,
  isSelected = false,
  onToggleSelect,
}: {
  task: Task;
  currentUser: TenantTokenPayload;
  statusConfigs: StatusConfig[];
  onClick: () => void;
  onStatusChange: (id: string, status: string) => void;
  bulkMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const doneKeys = statusConfigs.filter((s) => s.type === "DONE").map((s) => s.key);
  const reviewKeys = statusConfigs.filter((s) => s.type === "REVIEW").map((s) => s.key);
  const overdue = isOverdue(task.dueDate) && !doneKeys.includes(task.status);
  const isAssignee = task.assigneeId === currentUser.userId;
  const isCreator = task.creatorId === currentUser.userId;
  const creatorRoleLevel = task.creator.roleLevel?.level ?? 0;
  const canComplete = isCreator || currentUser.isSuperAdmin || canCompleteTask(currentUser.level, creatorRoleLevel);
  const canMarkDone =
    canManageAnyTaskStatus(currentUser) ||
    (!isAssignee && (isCreator || currentUser.isSuperAdmin || canCompleteTask(currentUser.level, creatorRoleLevel)));

  // Upper-level assignment detection
  const isFromUpperLevel =
    task.creatorId !== currentUser.userId &&
    creatorRoleLevel < currentUser.level;
  const creatorColor = task.creator.roleLevel?.color;

  const currentIdx = statusConfigs.findIndex((s) => s.key === task.status);
  const nextConfig = currentIdx >= 0 && currentIdx < statusConfigs.length - 1 ? statusConfigs[currentIdx + 1] : null;
  const canAdvance = nextConfig
    ? nextConfig.type === "DONE"
      ? canMarkDone
      : isAssignee || canComplete
    : false;
  const nextStatus = canAdvance ? nextConfig?.key ?? null : null;
  const isReview = reviewKeys.includes(task.status);

  return (
    <div
      className={cn(
        "border-l-4 bg-surface-800 border border-surface-700 rounded-xl p-4 hover:border-surface-600 transition-all cursor-pointer group",
        bulkMode && isSelected ? "ring-1 ring-primary-500/60 border-primary-500/50" : "",
        overdue ? "border-red-500/40 bg-red-500/5" : "",
        isReview && !overdue ? "border-amber-500/30 bg-amber-500/5" : ""
      )}
      style={{
        borderLeftColor: overdue
          ? undefined
          : isFromUpperLevel && creatorColor
          ? creatorColor
          : isReview
          ? "#f59e0b"
          : "#334155",
        backgroundColor:
          isFromUpperLevel && creatorColor && !overdue
            ? creatorColor + "0d"
            : undefined,
      }}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {bulkMode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(task.id);
            }}
            className={cn(
              "mt-0.5 w-5 h-5 rounded border flex items-center justify-center text-[10px] font-bold",
              isSelected
                ? "bg-primary-500/30 border-primary-500/60 text-primary-200"
                : "border-surface-600 text-surface-500"
            )}
            title={isSelected ? "Deselect" : "Select"}
          >
            {isSelected ? "✓" : ""}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium truncate", overdue ? "text-red-400" : "text-surface-100")}>
            {task.title}
          </p>

          {/* Upper-level assignment badge */}
          {isFromUpperLevel && creatorColor && (
            <div className="flex items-center gap-1.5 mt-1">
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: creatorColor }}
              />
              <span className="text-[10px] font-semibold" style={{ color: creatorColor }}>
                {task.creator.roleLevel?.name ?? "Admin"} · {task.creator.firstName} {task.creator.lastName}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {(() => {
              const sc = statusConfigs.find((s) => s.key === task.status);
              return sc ? (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: sc.color + "25", color: sc.color }}
                >
                  {sc.label}
                </span>
              ) : <StatusBadge status={task.status} />;
            })()}
            <PriorityBadge priority={task.priority} />
            {task.dueDate && (
              <span className={cn("text-xs flex items-center gap-1", overdue ? "text-red-400" : "text-surface-500")}>
                <Calendar className="w-3 h-3" />
                {overdue ? "Overdue · " : ""}{formatDate(task.dueDate)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Avatar firstName={task.assignee.firstName} lastName={task.assignee.lastName} avatarUrl={task.assignee.avatarUrl} size="xs" />
          {nextStatus && nextConfig && (
            <button
              onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, nextStatus); }}
              className="hidden group-hover:flex items-center gap-1 text-xs bg-primary-500/20 text-primary-400 border border-primary-500/30 px-2.5 py-1 rounded-lg hover:bg-primary-500/30 transition-all"
            >
              → {nextConfig.label.split(" ")[0]}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachmentIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <Image className="w-4 h-4 text-blue-400" />;
  if (mimeType === "application/pdf") return <FileText className="w-4 h-4 text-red-400" />;
  return <File className="w-4 h-4 text-surface-400" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentsSection({
  task,
  slug,
  userId,
  isSuperAdmin,
  onAttachmentsChange,
}: {
  task: Task;
  slug: string;
  userId: string;
  isSuperAdmin: boolean;
  onAttachmentsChange: (attachments: import("@/types").Attachment[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState(task.attachments ?? []);
  const [dragOver, setDragOver] = useState(false);

  const doUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch(
        `/api/upload?type=attachment&slug=${encodeURIComponent(slug)}`,
        { method: "POST", body: fd }
      );
      const upData = await upRes.json();
      if (!upRes.ok) { toast.error(upData.error || "Upload failed"); return; }

      const saveRes = await fetch(`/api/t/${slug}/tasks/${task.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: upData.url, fileName: upData.fileName, fileSize: upData.fileSize, mimeType: upData.mimeType, key: upData.key }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) { toast.error(saveData.error || "Failed to link attachment"); return; }

      const next = [...attachments, saveData.data];
      setAttachments(next);
      onAttachmentsChange(next);
      toast.success("Attachment added");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) doUpload(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) doUpload(f);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/t/${slug}/tasks/${task.id}/attachments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentId: id }),
    });
    if (res.ok) {
      const next = attachments.filter((a) => a.id !== id);
      setAttachments(next);
      onAttachmentsChange(next);
      toast.success("Attachment removed");
    } else {
      toast.error("Could not delete attachment");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-surface-400 flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          Attachments {attachments.length > 0 && <span className="text-surface-500">({attachments.length})</span>}
        </p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-xs text-primary-400 hover:text-primary-300 transition-colors flex items-center gap-1 disabled:opacity-50"
        >
          <Upload className="w-3 h-3" />
          {uploading ? "Uploading…" : "Add file"}
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
      </div>

      {/* Drop zone (shown when no attachments, acts as hint) */}
      {attachments.length === 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all",
            dragOver
              ? "border-primary-500/60 bg-primary-500/10"
              : "border-surface-700 hover:border-surface-600 hover:bg-surface-800/50"
          )}
        >
          <Upload className="w-5 h-5 text-surface-500 mx-auto mb-1.5" />
          <p className="text-xs text-surface-500">Drop a file or click to upload</p>
          <p className="text-[10px] text-surface-600 mt-0.5">Images, PDF, Word, Excel · max 10 MB</p>
        </div>
      )}

      {/* Attachment list */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-3 bg-surface-750 rounded-xl px-3 py-2.5 group"
            >
              <AttachmentIcon mimeType={att.mimeType} />
              <div className="flex-1 min-w-0">
                <a
                  href={att.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-surface-200 hover:text-primary-400 truncate block transition-colors"
                >
                  {att.fileName}
                </a>
                <p className="text-[10px] text-surface-500">{formatBytes(att.fileSize)}</p>
              </div>
              {(att.uploaderId === userId || isSuperAdmin) && (
                <button
                  onClick={() => handleDelete(att.id)}
                  className="opacity-0 group-hover:opacity-100 text-surface-500 hover:text-red-400 transition-all p-1 flex-shrink-0"
                  title="Remove attachment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {/* Drop zone overlay when already has attachments */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "border border-dashed rounded-xl px-3 py-2 text-center transition-all cursor-pointer",
              dragOver ? "border-primary-500/60 bg-primary-500/10" : "border-surface-700/50 hover:border-surface-600"
            )}
            onClick={() => fileRef.current?.click()}
          >
            <p className="text-[10px] text-surface-600">+ drop or click to add more</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskDetail({
  task,
  user,
  slug,
  statusConfigs,
  onStatusChange,
  onClose,
  onTaskUpdate,
  onTaskDelete,
}: {
  task: Task;
  user: TenantTokenPayload;
  slug: string;
  statusConfigs: StatusConfig[];
  onStatusChange: (s: string) => void;
  onClose: () => void;
  onTaskUpdate: (t: Task) => void;
  onTaskDelete: (taskId: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const isAssignee = task.assigneeId === user.userId;
  const isCreator = task.creatorId === user.userId;
  const creatorRoleLevel = task.creator.roleLevel?.level ?? 0;
  const canComplete = isCreator || user.isSuperAdmin || canCompleteTask(user.level, creatorRoleLevel);
  const canMarkDone =
    canManageAnyTaskStatus(user) ||
    (!isAssignee && (isCreator || user.isSuperAdmin || canCompleteTask(user.level, creatorRoleLevel)));
  const canSetAnyStatus = canManageAnyTaskStatus(user);

  const isFromUpperLevel =
    task.creatorId !== user.userId &&
    creatorRoleLevel < user.level;
  const creatorColor = task.creator.roleLevel?.color;

  const currentIdx = statusConfigs.findIndex((s) => s.key === task.status);
  const currentConfig = statusConfigs[currentIdx];
  const doneKeys = statusConfigs.filter((s) => s.type === "DONE").map((s) => s.key);
  const nextConfigs = statusConfigs.slice(currentIdx + 1);
  const canDelete = isCreator || user.isSuperAdmin;

  const handleDeleteTask = async () => {
    if (!canDelete) return;
    if (!confirm("Delete this task permanently? This action cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/t/${slug}/tasks/${task.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Failed to delete task");
        return;
      }
      toast.success("Task deleted");
      onTaskDelete(task.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Upper-level assignment banner */}
      {isFromUpperLevel && creatorColor && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 border"
          style={{
            backgroundColor: creatorColor + "1a",
            borderColor: creatorColor + "40",
          }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: creatorColor }}
          />
          <div>
            <p className="text-xs font-semibold" style={{ color: creatorColor }}>
              Assigned by {task.creator.roleLevel?.name ?? "Admin"}
            </p>
            <p className="text-[11px] text-surface-400 mt-0.5">
              {task.creator.firstName} {task.creator.lastName}
            </p>
          </div>
        </div>
      )}

      {task.description && (
        <p className="text-sm text-surface-400 leading-relaxed">{task.description}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-750 rounded-xl p-3">
          <p className="text-xs text-surface-500 mb-1.5">Status</p>
          {currentConfig ? (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: currentConfig.color + "22", color: currentConfig.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentConfig.color }} />
              {currentConfig.label}
            </span>
          ) : (
            <span className="text-xs text-surface-400">{task.status}</span>
          )}
        </div>
        <div className="bg-surface-750 rounded-xl p-3">
          <p className="text-xs text-surface-500 mb-1.5">Priority</p>
          <PriorityBadge priority={task.priority} />
        </div>
        <div className="bg-surface-750 rounded-xl p-3">
          <p className="text-xs text-surface-500 mb-1.5">Assigned To</p>
          <div className="flex items-center gap-2">
            <Avatar firstName={task.assignee.firstName} lastName={task.assignee.lastName} avatarUrl={task.assignee.avatarUrl} size="xs" />
            <span className="text-xs text-surface-200">{task.assignee.firstName} {task.assignee.lastName}</span>
          </div>
        </div>
        <div
          className="rounded-xl p-3"
          style={
            isFromUpperLevel && creatorColor
              ? { backgroundColor: creatorColor + "15", border: `1px solid ${creatorColor}40` }
              : { backgroundColor: "var(--color-surface-750)" }
          }
        >
          <p className="text-xs text-surface-500 mb-1.5">Created By</p>
          <div className="flex items-center gap-2">
            <Avatar firstName={task.creator.firstName} lastName={task.creator.lastName} avatarUrl={task.creator.avatarUrl} size="xs" />
            <div>
              <span className="text-xs text-surface-200">{task.creator.firstName} {task.creator.lastName}</span>
              {isFromUpperLevel && (
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: creatorColor }}>
                  {task.creator.roleLevel?.name ?? "Admin"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {task.dueDate && (
        <div className={cn("flex items-center gap-2 text-sm", isOverdue(task.dueDate) && !doneKeys.includes(task.status) ? "text-red-400" : "text-surface-400")}>
          <Calendar className="w-4 h-4" />
          {isOverdue(task.dueDate) && !doneKeys.includes(task.status) ? "⚠ Overdue — " : "Due: "}
          {formatDate(task.dueDate)}
        </div>
      )}

      {/* Status progress bar */}
      <div className="flex items-center gap-1.5">
        {statusConfigs.map((s, i) => (
          <div
            key={s.key}
            className={cn("flex-1 h-1.5 rounded-full transition-all", i > currentIdx ? "bg-surface-700" : "")}
            style={{ backgroundColor: i <= currentIdx ? s.color : undefined }}
          />
        ))}
      </div>

      {/* Action buttons */}
      {canSetAnyStatus && (
        <div className="space-y-2">
          <p className="text-xs text-surface-500">Set status (full access)</p>
          <Select
            value={task.status}
            onChange={(e) => {
              const v = e.target.value;
              if (v !== task.status) onStatusChange(v);
            }}
          >
            {statusConfigs.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {/* Assignee can advance to non-DONE next steps (not backlog) */}
        {!canSetAnyStatus &&
          isAssignee &&
          nextConfigs.filter((s) => s.type !== "DONE").map((s) => (
            <Button key={s.key} onClick={() => onStatusChange(s.key)} size="sm" variant="secondary">
              → {s.label}
            </Button>
          ))}
        {/* Managers / creators mark DONE — not assignee-only */}
        {!canSetAnyStatus && canMarkDone && nextConfigs.filter((s) => s.type === "DONE").map((s) => (
          <Button key={s.key} onClick={() => { onStatusChange(s.key); onClose(); }} size="sm">
            ✓ Mark Complete
          </Button>
        ))}
        {canDelete && (
          <Button
            size="sm"
            variant="secondary"
            loading={deleting}
            onClick={handleDeleteTask}
            className="text-red-400 border-red-500/30 hover:bg-red-500/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Task
          </Button>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-surface-700/50" />

      {/* Attachments */}
      <AttachmentsSection
        task={task}
        slug={slug}
        userId={user.userId}
        isSuperAdmin={user.isSuperAdmin}
        onAttachmentsChange={(atts) => onTaskUpdate({ ...task, attachments: atts })}
      />

      {/* Divider */}
      <div className="border-t border-surface-700/50" />

      {/* Comments */}
      <TaskComments taskId={task.id} slug={slug} user={user} />
    </div>
  );
}

function ArchivedTaskList({ tasks }: { tasks: Task[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Archive className="w-4 h-4 text-surface-400" />
        <h2 className="text-sm font-semibold text-surface-400">Archived Tasks ({tasks.length})</h2>
      </div>
      {tasks.length === 0 ? (
        <div className="py-12 text-center text-surface-600 text-sm">No archived tasks</div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="bg-surface-800/60 border border-surface-700/50 rounded-xl p-4 opacity-75">
              <p className="text-sm font-medium text-surface-300 line-through">{task.title}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-surface-500">Completed {formatDate(task.completedAt)}</span>
                <span className="text-xs text-surface-600">•</span>
                <div className="flex items-center gap-1.5">
                  <Avatar firstName={task.assignee.firstName} lastName={task.assignee.lastName} size="xs" />
                  <span className="text-xs text-surface-500">{task.assignee.firstName}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
