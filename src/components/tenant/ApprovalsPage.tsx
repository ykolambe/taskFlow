"use client";

import { useState } from "react";
import {
  UserCheck, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  ChevronRight, Copy, Eye, EyeOff, Key,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { ApprovalBadge } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { TenantTokenPayload } from "@/lib/auth";
import { ApprovalRequest, NewUserData, UserBrief, isRemoveMemberPayload } from "@/types";
import { formatRelative, copyToClipboard } from "@/lib/utils";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { getNextRequiredApprover } from "@/lib/approvalChain";

interface Props {
  currentUser: TenantTokenPayload;
  approvals: ApprovalRequest[];
  slug: string;
  companyId: string;
  /** Full user map so we can resolve approverChain IDs to names */
  allUsers: UserBrief[];
}

export default function ApprovalsPage({
  currentUser,
  approvals: initialApprovals,
  slug,
  allUsers,
}: Props) {
  const router = useRouter();
  const [approvals, setApprovals] = useState(initialApprovals);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [commentModal, setCommentModal] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [comment, setComment] = useState("");
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const pending = approvals.filter((a) => a.status === "PENDING");
  const resolved = approvals.filter((a) => a.status !== "PENDING");

  // Build a lookup map from user ID → user brief
  const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));

  const handleAction = async (requestId: string, action: "approve" | "reject", commentText?: string) => {
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/t/${slug}/approvals/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: commentText }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Action failed");
        return;
      }

      if (action === "approve") {
        if (data.removedUserId) {
          toast.success("All approvals complete — member has been removed.");
        } else if (data.credentials) {
          setCredentials(data.credentials);
          toast.success("All approvals complete — new member has been added!");
        } else {
          toast.success("Approved! Request passed to the next level.");
        }
      } else {
        toast.success("Request rejected.");
      }

      setApprovals((prev) =>
        prev.map((a) =>
          a.id === requestId
            ? { ...a, status: data.data?.status ?? a.status, approvals: data.data?.approvals ?? a.approvals }
            : a
        )
      );
      setCommentModal(null);
      setComment("");
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-surface-100 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-primary-400" /> Approvals
        </h1>
        <p className="text-surface-400 text-xs mt-0.5">Add or remove team members (approval required when applicable)</p>
      </div>

      {/* Awaiting my action */}
      {pending.filter((a) => {
        const chain = a.approverChain ?? [];
        const next = getNextRequiredApprover(chain, a.approvals);
        const turn = chain.length === 0 ? a.requesterId : next;
        return turn === currentUser.userId;
      }).length > 0 && (
        <div className="mb-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-400 mb-3">
            <Clock className="w-4 h-4" /> Awaiting Your Action (
            {pending.filter((a) => {
              const chain = a.approverChain ?? [];
              const next = getNextRequiredApprover(chain, a.approvals);
              const turn = chain.length === 0 ? a.requesterId : next;
              return turn === currentUser.userId;
            }).length}
            )
          </h2>
          <div className="space-y-3">
            {pending
              .filter((a) => {
                const chain = a.approverChain ?? [];
                const next = getNextRequiredApprover(chain, a.approvals);
                const turn = chain.length === 0 ? a.requesterId : next;
                return turn === currentUser.userId;
              })
              .map((req) => (
                <ApprovalCard
                  key={req.id}
                  request={req}
                  currentUser={currentUser}
                  userMap={userMap}
                  expanded={expandedId === req.id}
                  onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
                  onAction={(action) => {
                    if (action === "reject") {
                      setCommentModal({ id: req.id, action: "reject" });
                    } else {
                      handleAction(req.id, action);
                    }
                  }}
                  loading={actionLoading === req.id}
                />
              ))}
          </div>
        </div>
      )}

      {/* My submitted requests (pending, not my turn) */}
      {pending.filter((a) => {
        const chain = a.approverChain ?? [];
        const next = getNextRequiredApprover(chain, a.approvals);
        const turn = chain.length === 0 ? a.requesterId : next;
        return a.requesterId === currentUser.userId && turn !== currentUser.userId;
      }).length > 0 && (
        <div className="mb-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-blue-400 mb-3">
            <Clock className="w-4 h-4" /> My Submitted Requests
          </h2>
          <div className="space-y-3">
            {pending
              .filter((a) => {
                const chain = a.approverChain ?? [];
                const next = getNextRequiredApprover(chain, a.approvals);
                const turn = chain.length === 0 ? a.requesterId : next;
                return a.requesterId === currentUser.userId && turn !== currentUser.userId;
              })
              .map((req) => (
                <ApprovalCard
                  key={req.id}
                  request={req}
                  currentUser={currentUser}
                  userMap={userMap}
                  expanded={expandedId === req.id}
                  onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
                  readonly
                />
              ))}
          </div>
        </div>
      )}

      {/* History */}
      {resolved.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-3">
            History
          </h2>
          <div className="space-y-2">
            {resolved.map((req) => (
              <ApprovalCard
                key={req.id}
                request={req}
                currentUser={currentUser}
                userMap={userMap}
                expanded={expandedId === req.id}
                onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
                readonly
              />
            ))}
          </div>
        </div>
      )}

      {approvals.length === 0 && (
        <div className="py-16 text-center">
          <UserCheck className="w-12 h-12 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 font-medium">No approval requests</p>
          <p className="text-surface-600 text-sm mt-1">
            Requests to add or remove team members will appear here
          </p>
        </div>
      )}

      {/* Reject comment modal */}
      <Modal
        isOpen={!!commentModal}
        onClose={() => { setCommentModal(null); setComment(""); }}
        title="Reject Request"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-400">
            Add an optional comment explaining the rejection:
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Reason for rejection..."
            className="w-full bg-surface-750 border border-surface-600 rounded-xl px-3 py-2.5 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-red-500 resize-none"
          />
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => { setCommentModal(null); setComment(""); }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={!!actionLoading}
              onClick={() => commentModal && handleAction(commentModal.id, "reject", comment)}
            >
              Reject
            </Button>
          </div>
        </div>
      </Modal>

      {/* Credentials modal — shown after final approval creates the user */}
      <Modal
        isOpen={!!credentials}
        onClose={() => { setCredentials(null); setShowPassword(false); }}
        title="New Member Credentials"
        description="Share these login credentials with the new team member. They will not be shown again."
        size="sm"
      >
        {credentials && (
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              New member has been added to your team!
            </div>

            <div className="space-y-3">
              <CredentialRow
                label="Username"
                value={credentials.username}
                onCopy={async () => {
                  const ok = await copyToClipboard(credentials.username);
                  if (ok) toast.success("Copied!");
                  else toast.error("Could not copy — select the text manually");
                }}
              />
              <CredentialRow
                label="Password"
                value={credentials.password}
                masked={!showPassword}
                onToggleMask={() => setShowPassword((s) => !s)}
                onCopy={async () => {
                  const ok = await copyToClipboard(credentials.password);
                  if (ok) toast.success("Copied!");
                  else toast.error("Could not copy — select the text manually");
                }}
              />
            </div>

            <p className="text-xs text-surface-500 text-center">
              <Key className="w-3 h-3 inline mr-1" />
              Store these safely — this dialog cannot be reopened
            </p>

            <Button
              className="w-full"
              onClick={() => { setCredentials(null); setShowPassword(false); }}
            >
              Done
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Credential row helper ────────────────────────────────────────────────────

function CredentialRow({
  label,
  value,
  masked,
  onToggleMask,
  onCopy,
}: {
  label: string;
  value: string;
  masked?: boolean;
  onToggleMask?: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="bg-surface-750 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-surface-500 mb-0.5">{label}</p>
        <p className="text-sm font-mono text-surface-100 truncate">
          {masked ? "•".repeat(value.length) : value}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {onToggleMask && (
          <button onClick={onToggleMask} className="text-surface-500 hover:text-surface-300 transition-colors p-1">
            {masked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        )}
        <button onClick={onCopy} className="text-surface-500 hover:text-primary-400 transition-colors p-1">
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Approval card ────────────────────────────────────────────────────────────

function ApprovalCard({
  request,
  currentUser,
  userMap,
  expanded,
  onToggle,
  onAction,
  loading,
  readonly,
}: {
  request: ApprovalRequest;
  currentUser: TenantTokenPayload;
  userMap: Record<string, UserBrief>;
  expanded: boolean;
  onToggle: () => void;
  onAction?: (action: "approve" | "reject") => void;
  loading?: boolean;
  readonly?: boolean;
}) {
  const payload = request.newUserData;
  const isRemove = isRemoveMemberPayload(payload);
  const newUser = isRemove ? null : (payload as NewUserData);
  const removePayload = isRemove ? payload : null;
  const chain = request.approverChain ?? [];
  const nextRequired = getNextRequiredApprover(chain, request.approvals);
  const turnUserId = chain.length === 0 ? request.requesterId : nextRequired;

  const canAct =
    !readonly &&
    request.status === "PENDING" &&
    turnUserId !== null &&
    currentUser.userId === turnUserId;

  const alreadyActed = request.approvals.some(
    (a) => a.approverId === currentUser.userId
  );

  // Determine step-level progress for the chain
  const approvedSet = new Set(
    request.approvals.filter((a) => a.status === "APPROVED").map((a) => a.approverId)
  );
  const rejectedSet = new Set(
    request.approvals.filter((a) => a.status === "REJECTED").map((a) => a.approverId)
  );

  return (
    <div
      className={cn(
        "bg-surface-800 border rounded-2xl overflow-hidden transition-all",
        request.status === "PENDING" ? "border-amber-500/30" : "border-surface-700"
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar
            firstName={request.requester.firstName}
            lastName={request.requester.lastName}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-surface-200 truncate">
              <span className="text-surface-100 font-semibold">
                {request.requester.firstName} {request.requester.lastName}
              </span>{" "}
              {isRemove ? (
                <>
                  wants to remove{" "}
                  <span className="text-surface-100 font-semibold">
                    {removePayload!.firstName} {removePayload!.lastName}
                  </span>
                </>
              ) : (
                <>
                  wants to add{" "}
                  <span className="text-surface-100 font-semibold">
                    {newUser!.firstName} {newUser!.lastName}
                  </span>
                </>
              )}
            </p>
            <p className="text-xs text-surface-500 mt-0.5">
              {isRemove ? (
                <>
                  <span className="text-red-400/90">Remove from team</span>
                  {" · "}
                  {removePayload!.roleLevelName}
                </>
              ) : (
                <>
                  as{" "}
                  <span
                    style={{
                      color: request.requester.roleLevel?.color ?? "#6366f1",
                    }}
                  >
                    {newUser!.roleLevelName}
                  </span>
                </>
              )}{" "}
              · {formatRelative(request.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ApprovalBadge status={request.status} />
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-surface-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-surface-500" />
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-surface-700 px-4 py-4 space-y-4">
          {/* New user details */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {isRemove
              ? [
                  { label: "Email", value: removePayload!.email },
                  { label: "Role", value: removePayload!.roleLevelName },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-surface-750 rounded-xl p-3">
                    <p className="text-surface-500 mb-0.5">{label}</p>
                    <p className="text-surface-200 font-medium">{value}</p>
                  </div>
                ))
              : [
                  { label: "Email", value: newUser!.email },
                  { label: "Username", value: newUser!.username || "—" },
                  { label: "Role Level", value: newUser!.roleLevelName },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-surface-750 rounded-xl p-3">
                    <p className="text-surface-500 mb-0.5">{label}</p>
                    <p className="text-surface-200 font-medium">{value}</p>
                  </div>
                ))}
          </div>

          {/* Approval chain progress */}
          {chain.length > 0 && (
            <div>
              <p className="text-xs text-surface-500 mb-3 uppercase tracking-wider">
                Approval Chain
              </p>
              <div className="space-y-2">
                {chain.map((uid, idx) => {
                  const chainUser = userMap[uid];
                  const isApproved = approvedSet.has(uid);
                  const isRejected = rejectedSet.has(uid);
                  const isCurrent = uid === nextRequired && request.status === "PENDING";
                  const isPending = !isApproved && !isRejected && !isCurrent;
                  const isMe = uid === currentUser.userId;

                  return (
                    <div key={uid} className="flex items-center gap-3">
                      {/* Step connector */}
                      {idx > 0 && (
                        <div className="w-5 flex justify-center">
                          <div
                            className={cn(
                              "w-0.5 h-4 -mt-3",
                              isApproved || request.status === "APPROVED"
                                ? "bg-emerald-500/50"
                                : "bg-surface-700"
                            )}
                          />
                        </div>
                      )}

                      <div
                        className={cn(
                          "flex items-center gap-3 flex-1 rounded-xl px-3 py-2.5 border transition-all",
                          isApproved
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : isRejected
                            ? "bg-red-500/10 border-red-500/30"
                            : isCurrent
                            ? "bg-amber-500/10 border-amber-500/40"
                            : "bg-surface-750 border-surface-700 opacity-60",
                          idx === 0 ? "" : "ml-5"
                        )}
                      >
                        {/* Status icon */}
                        <div className="flex-shrink-0">
                          {isApproved ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                          ) : isRejected ? (
                            <XCircle className="w-4 h-4 text-red-400" />
                          ) : isCurrent ? (
                            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-surface-600" />
                          )}
                        </div>

                        {/* User info */}
                        <div className="flex-1 min-w-0">
                          {chainUser ? (
                            <div className="flex items-center gap-2">
                              <Avatar
                                firstName={chainUser.firstName}
                                lastName={chainUser.lastName}
                                avatarUrl={chainUser.avatarUrl}
                                size="xs"
                              />
                              <div>
                                <p className="text-xs font-medium text-surface-200">
                                  {chainUser.firstName} {chainUser.lastName}
                                  {isMe && (
                                    <span className="ml-1.5 text-[10px] text-primary-400">
                                      (you)
                                    </span>
                                  )}
                                </p>
                                <p className="text-[10px] text-surface-500">
                                  {chainUser.roleLevel?.name ?? ""}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-surface-500">Unknown user</p>
                          )}
                        </div>

                        {/* Step label */}
                        <span
                          className={cn(
                            "text-[10px] font-semibold flex-shrink-0",
                            isApproved
                              ? "text-emerald-400"
                              : isRejected
                              ? "text-red-400"
                              : isCurrent
                              ? "text-amber-400"
                              : "text-surface-600"
                          )}
                        >
                          {isApproved
                            ? "Approved"
                            : isRejected
                            ? "Rejected"
                            : isCurrent
                            ? "Awaiting"
                            : "Pending"}
                        </span>

                        {/* Comment */}
                        {(isApproved || isRejected) && (() => {
                          const entry = request.approvals.find((a) => a.approverId === uid);
                          return entry?.comment ? (
                            <span className="text-[10px] text-surface-500 italic ml-1 truncate max-w-24">
                              "{entry.comment}"
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  );
                })}

                {/* Final step: user creation */}
                <div className="flex items-center gap-3 ml-5">
                  <div
                    className={cn(
                      "flex items-center gap-2 flex-1 rounded-xl px-3 py-2 border",
                      request.status === "APPROVED"
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-surface-750 border-surface-700 opacity-50"
                    )}
                  >
                    {request.status === "APPROVED" ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-surface-600 flex-shrink-0" />
                    )}
                    <p className="text-xs text-surface-400">
                      {isRemove
                        ? request.status === "APPROVED"
                          ? "Member removed from team"
                          : "Member will be removed after all approvals"
                        : request.status === "APPROVED"
                          ? "New member added to system"
                          : "Member will be created after all approvals"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {canAct && !alreadyActed && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="danger"
                onClick={() => onAction?.("reject")}
                loading={loading}
                className="flex-1"
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </Button>
              <Button
                size="sm"
                onClick={() => onAction?.("approve")}
                loading={loading}
                className="flex-1"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Approve
              </Button>
            </div>
          )}

          {canAct && alreadyActed && (
            <p className="text-xs text-surface-500 text-center py-1">
              You have already acted on this request
            </p>
          )}

          {!canAct && request.status === "PENDING" && nextRequired && nextRequired !== currentUser.userId && (
            <div className="flex items-center gap-2 bg-surface-750 rounded-xl px-3 py-2.5 text-xs text-surface-500">
              <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              Waiting for{" "}
              <span className="text-surface-300 font-medium">
                {userMap[nextRequired]
                  ? `${userMap[nextRequired].firstName} ${userMap[nextRequired].lastName}`
                  : "next approver"}
              </span>
              {userMap[nextRequired]?.roleLevel?.name && (
                <span className="text-surface-500">
                  · {userMap[nextRequired].roleLevel.name}
                </span>
              )}
              <ChevronRight className="w-3 h-3 ml-auto" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
