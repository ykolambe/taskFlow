"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { TenantTokenPayload } from "@/lib/auth";
import type { TaskRequest, UserBrief } from "@/types";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Input";
import { PriorityBadge, ApprovalBadge } from "@/components/ui/Badge";
import { formatDate, formatRelative } from "@/lib/utils";
import { ClipboardList, Check, X, Plus } from "lucide-react";
import { AttachmentPreviewRow } from "@/components/tenant/AttachmentPreview";
import TaskRequestModal from "@/components/tenant/TaskRequestModal";
import toast from "react-hot-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPrimarySubtreeIds, linksFromDb } from "@/lib/reportingLinks";

type Tab = "incoming" | "outgoing" | "all";

function reqRef(id: string) {
  return `REQ-${id.slice(0, 8)}`;
}

interface Props {
  user: TenantTokenPayload;
  slug: string;
}

export default function TaskRequestsInbox({ user, slug }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("incoming");
  const [list, setList] = useState<TaskRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<UserBrief[]>([]);
  const [reportingLinkRows, setReportingLinkRows] = useState<
    { subordinateId: string; managerId: string; sortOrder: number }[]
  >([]);

  const [actionRow, setActionRow] = useState<TaskRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const scope = tab === "all" ? "all" : tab;
      const res = await fetch(`/api/t/${slug}/task-requests?scope=${scope}`);
      const data = await res.json();
      if (data.success) setList(data.data);
      else toast.error(data.error || "Failed to load");
    } catch {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [slug, tab]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    fetch(`/api/t/${slug}/users`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setAllUsers(d.data);
          if (Array.isArray(d.reportingLinks)) setReportingLinkRows(d.reportingLinks);
        }
      })
      .catch(() => {});
  }, [slug]);

  const assignableForApprove = useMemo(() => {
    if (!actionRow || actionType !== "approve") return [];
    const lr = linksFromDb(reportingLinkRows);
    const ids = user.isSuperAdmin
      ? allUsers.map((u) => u.id)
      : getPrimarySubtreeIds(lr, actionRow.approverId);
    return allUsers.filter((u) => ids.includes(u.id) && u.id); // active only
  }, [actionRow, actionType, allUsers, user.isSuperAdmin, reportingLinkRows]);

  useEffect(() => {
    if (actionRow && actionType === "approve") {
      setAssigneeId(actionRow.requesterId);
      setRejectComment("");
    }
    if (actionRow && actionType === "reject") {
      setRejectComment("");
    }
  }, [actionRow, actionType]);

  const openApprove = (r: TaskRequest) => {
    setActionRow(r);
    setActionType("approve");
  };

  const openReject = (r: TaskRequest) => {
    setActionRow(r);
    setActionType("reject");
  };

  const closeModal = () => {
    setActionRow(null);
    setActionType(null);
  };

  const submitAction = async () => {
    if (!actionRow || !actionType) return;
    setSubmitting(true);
    try {
      const body =
        actionType === "approve"
          ? { action: "approve", assigneeId: assigneeId || actionRow.requesterId }
          : { action: "reject", comment: rejectComment.trim() || undefined };

      const res = await fetch(`/api/t/${slug}/task-requests/${actionRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed");
        return;
      }
      toast.success(actionType === "approve" ? "Approved — task created" : "Request rejected");
      closeModal();
      loadRequests();
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const showAllTab = user.isSuperAdmin;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary-500/15 text-primary-400">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-50">Task requests</h1>
            <p className="text-sm text-surface-500">Submit work for approval; approvers turn it into a real task.</p>
          </div>
        </div>
        <Button size="sm" className="shrink-0 self-start sm:self-center" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" /> New task request
        </Button>
      </div>

      <TaskRequestModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        slug={slug}
        onCreated={() => {
          setTab("outgoing");
          loadRequests();
          router.refresh();
        }}
      />

      <div className="flex gap-2 border-b border-surface-800 pb-2">
        <button
          type="button"
          onClick={() => setTab("incoming")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "incoming" ? "bg-surface-800 text-surface-100" : "text-surface-500 hover:text-surface-300"
          }`}
        >
          For my approval
        </button>
        <button
          type="button"
          onClick={() => setTab("outgoing")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "outgoing" ? "bg-surface-800 text-surface-100" : "text-surface-500 hover:text-surface-300"
          }`}
        >
          My requests
        </button>
        {showAllTab && (
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "all" ? "bg-surface-800 text-surface-100" : "text-surface-500 hover:text-surface-300"
            }`}
          >
            All (company)
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-surface-500">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-surface-500">No requests in this view.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li
              key={r.id}
              className="bg-surface-900/80 border border-surface-800 rounded-xl p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-surface-500 font-mono">{reqRef(r.id)}</p>
                  <h2 className="text-base font-semibold text-surface-100">{r.title}</h2>
                  {r.description && (
                    <p className="text-sm text-surface-400 mt-1 whitespace-pre-wrap">{r.description}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <ApprovalBadge status={r.status} />
                  <PriorityBadge priority={r.priority} />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-surface-500">
                <span>
                  From{" "}
                  <span className="text-surface-300">
                    {r.requester.firstName} {r.requester.lastName}
                  </span>
                </span>
                <span>
                  Approver{" "}
                  <span className="text-surface-300">
                    {r.approver.firstName} {r.approver.lastName}
                  </span>
                </span>
                {r.dueDate && <span>Due {formatDate(r.dueDate)}</span>}
                <span>{formatRelative(r.createdAt)}</span>
              </div>

              {r.attachmentFileUrl && (
                <div className="pt-1">
                  <AttachmentPreviewRow
                    fileUrl={r.attachmentFileUrl}
                    fileName={r.attachmentFileName || "Attachment"}
                    fileSize={r.attachmentFileSize ?? 0}
                    mimeType={r.attachmentMimeType || "application/octet-stream"}
                    compact
                  />
                </div>
              )}

              {r.status === "REJECTED" && r.rejectComment && (
                <p className="text-xs text-red-400/90">Reason: {r.rejectComment}</p>
              )}

              {r.status === "APPROVED" && r.createdTask && (
                <Link
                  href={`/t/${slug}/tasks?task=${r.createdTask.id}`}
                  className="inline-flex text-xs text-primary-400 hover:underline"
                >
                  Open task →
                </Link>
              )}

              {r.status === "PENDING" && (user.isSuperAdmin || user.userId === r.approverId) && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => openApprove(r)}>
                    <Check className="w-4 h-4" /> Approve
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openReject(r)}>
                    <X className="w-4 h-4" /> Reject
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        isOpen={!!actionRow && actionType === "approve"}
        onClose={closeModal}
        title="Approve and create task"
        size="md"
      >
        {actionRow && (
          <div className="space-y-4">
            <p className="text-sm text-surface-400">
              Choose who the task is assigned to (defaults to the person who requested it).
            </p>
            <Select
              label="Assign to"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              {assignableForApprove.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} — {u.roleLevel?.name ?? ""}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={closeModal}>
                Cancel
              </Button>
              <Button className="flex-1" loading={submitting} onClick={submitAction}>
                Approve
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!actionRow && actionType === "reject"}
        onClose={closeModal}
        title="Reject request"
        size="md"
      >
        {actionRow && (
          <div className="space-y-4">
            <Textarea
              label="Comment (optional)"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder="Why is this declined?"
            />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={closeModal}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" loading={submitting} onClick={submitAction}>
                Reject
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
