"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, Plus, Users, CheckSquare, ChevronRight, Shield, UserPlus, Copy, Eye, EyeOff, Key, RefreshCw } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { TenantTokenPayload } from "@/lib/auth";
import { User, RoleLevel } from "@/types";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import type { TeamWorkloadRow } from "@/lib/subtreeWorkload";
import WorkloadHeatmap from "@/components/tenant/WorkloadHeatmap";

interface Props {
  currentUser: TenantTokenPayload;
  users: User[];
  roleLevels: RoleLevel[];
  slug: string;
  companyId: string;
  workloadRows?: TeamWorkloadRow[];
}

export default function TeamPage({ currentUser, users, roleLevels, slug, companyId, workloadRows = [] }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [showAddMember, setShowAddMember] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [newMember, setNewMember] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    roleLevelId: "",
    parentId: currentUser.userId,
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedStats, setSelectedStats] = useState<{
    totals: { total: number; open: number; completed: number; archived: number };
    byStatus: Record<string, number>;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [newCreds, setNewCreds] = useState<{ email: string; username: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [updatingQaAccess, setUpdatingQaAccess] = useState(false);
  const [updatingSuperAdmin, setUpdatingSuperAdmin] = useState(false);
  const [savingRoleLevel, setSavingRoleLevel] = useState(false);
  const [selectedRoleLevelId, setSelectedRoleLevelId] = useState<string>("");
  const [memberListPage, setMemberListPage] = useState(1);
  const MEMBER_PAGE_SIZE = 40;

  const filtered = users.filter((u) => {
    const name = `${u.firstName} ${u.lastName} ${u.email} ${u.username}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (filterLevel !== "all" && u.roleLevelId !== filterLevel) return false;
    return true;
  });

  useEffect(() => {
    setMemberListPage(1);
  }, [search, filterLevel]);

  const pagedUsers = useMemo(
    () => filtered.slice(0, memberListPage * MEMBER_PAGE_SIZE),
    [filtered, memberListPage]
  );
  const hasMoreMembers = filtered.length > memberListPage * MEMBER_PAGE_SIZE;

  // Can current user directly add members?
  // Only if they are super admin OR their level is high enough (level 1 or 2 can direct add)
  const canDirectAdd = currentUser.isSuperAdmin || currentUser.level <= 1;
  const needsApproval = !canDirectAdd;

  const handleAddMember = async () => {
    if (!newMember.firstName || !newMember.lastName || !newMember.email || !newMember.roleLevelId) {
      toast.error("Please fill all required fields");
      return;
    }
    setAddingMember(true);
    try {
      if (needsApproval) {
        // Send approval request
        const res = await fetch(`/api/t/${slug}/approvals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newUserData: newMember }),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error || "Failed"); return; }
        toast.success("Approval request submitted! Awaiting manager approval.");
      } else {
        // Direct add
        const res = await fetch(`/api/t/${slug}/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newMember),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error || "Failed"); return; }
        if (data.credentials) {
          setNewCreds(data.credentials);
          toast.success("Team member added! Share login credentials.");
        } else {
          toast.success("Team member added!");
        }
        router.refresh();
      }
      setShowAddMember(false);
      setNewMember({ firstName: "", lastName: "", email: "", username: "", roleLevelId: "", parentId: currentUser.userId });
    } finally {
      setAddingMember(false);
    }
  };

  const grouped = useMemo(
    () =>
      roleLevels.reduce((acc, rl) => {
        acc[rl.id] = pagedUsers.filter((u) => u.roleLevelId === rl.id);
        return acc;
      }, {} as Record<string, User[]>),
    [roleLevels, pagedUsers]
  );

  const handleRegenerateCreds = async (userId: string) => {
    if (!currentUser.isSuperAdmin) {
      toast.error("Only super admin can regenerate credentials");
      return;
    }
    setRegenLoading(true);
    try {
      const res = await fetch(`/api/t/${slug}/users/${userId}`, { method: "PUT" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to regenerate credentials");
        return;
      }
      setNewCreds({
        email: data.email,
        username: data.username,
        password: data.password,
      });
      setShowPassword(false);
      toast.success("Credentials regenerated");
    } finally {
      setRegenLoading(false);
    }
  };

  const fetchUserStats = async (userId: string) => {
    setLoadingStats(true);
    try {
      const res = await fetch(`/api/t/${slug}/users/${userId}/task-stats`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load task stats");
        setSelectedStats(null);
        return;
      }
      setSelectedStats(data.data);
    } catch {
      toast.error("Failed to load task stats");
      setSelectedStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleToggleQaAccess = async (targetUser: User) => {
    if (!currentUser.isSuperAdmin) return;
    setUpdatingQaAccess(true);
    try {
      const res = await fetch(`/api/t/${slug}/users/${targetUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiLeaderQaEnabled: !targetUser.aiLeaderQaEnabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update access");
        return;
      }
      const next = Boolean(data.data?.aiLeaderQaEnabled);
      setSelectedUser((prev) => (prev ? { ...prev, aiLeaderQaEnabled: next } : prev));
      toast.success(next ? "LeaderGPT access enabled" : "LeaderGPT access disabled");
      router.refresh();
    } finally {
      setUpdatingQaAccess(false);
    }
  };

  const handleToggleSuperAdmin = async (targetUser: User) => {
    if (!currentUser.isSuperAdmin) return;
    setUpdatingSuperAdmin(true);
    try {
      const res = await fetch(`/api/t/${slug}/users/${targetUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSuperAdmin: !targetUser.isSuperAdmin }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update super admin");
        return;
      }
      const next = Boolean(data.data?.isSuperAdmin);
      setSelectedUser((prev) => (prev ? { ...prev, isSuperAdmin: next } : prev));
      toast.success(next ? "Super admin enabled" : "Super admin disabled");
      router.refresh();
    } finally {
      setUpdatingSuperAdmin(false);
    }
  };

  const handleSaveRoleLevel = async (targetUser: User) => {
    if (!currentUser.isSuperAdmin) return;
    setSavingRoleLevel(true);
    try {
      const res = await fetch(`/api/t/${slug}/users/${targetUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleLevelId: selectedRoleLevelId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update role level");
        return;
      }
      setSelectedUser((prev) =>
        prev
          ? { ...prev, roleLevelId: data.data?.roleLevelId ?? null, roleLevel: data.data?.roleLevel ?? null }
          : prev
      );
      toast.success("Role level updated");
      router.refresh();
    } finally {
      setSavingRoleLevel(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-surface-100">Team</h1>
          <p className="text-surface-400 text-xs mt-0.5">{users.length} members visible</p>
        </div>
        <Button onClick={() => setShowAddMember(true)} size="sm">
          <UserPlus className="w-4 h-4" />
          {needsApproval ? "Request Member" : "Add Member"}
        </Button>
      </div>

      <WorkloadHeatmap
        slug={slug}
        viewerUserId={currentUser.userId}
        users={users}
        initialRows={workloadRows}
      />

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
          <input
            placeholder="Search team..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-800 border border-surface-700 rounded-lg pl-9 pr-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500 transition-all"
          />
        </div>
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-xs text-surface-300 focus:outline-none focus:border-primary-500"
        >
          <option value="all">All Levels</option>
          {roleLevels.map((rl) => <option key={rl.id} value={rl.id}>{rl.name}</option>)}
        </select>
      </div>

      {/* Team by level */}
      <div className="space-y-5">
        {roleLevels.map((rl) => {
          const levelUsers = grouped[rl.id] || [];
          if (levelUsers.length === 0) return null;
          return (
            <div key={rl.id}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: rl.color }} />
                <h2 className="text-sm font-semibold text-surface-300">{rl.name}</h2>
                <span className="text-xs text-surface-600 bg-surface-800 px-2 py-0.5 rounded-full">{levelUsers.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {levelUsers.map((u) => (
                  <MemberCard
                    key={u.id}
                    user={u}
                    currentUserId={currentUser.userId}
                    roleColor={rl.color}
                    onClick={async () => {
                      setSelectedUser(u);
                      setSelectedRoleLevelId(u.roleLevelId ?? "");
                      setSelectedStats(null);
                      await fetchUserStats(u.id);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {hasMoreMembers && (
        <div className="flex justify-center py-6">
          <Button variant="secondary" size="sm" onClick={() => setMemberListPage((p) => p + 1)}>
            Show more members ({filtered.length - memberListPage * MEMBER_PAGE_SIZE} more)
          </Button>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="py-16 text-center">
          <Users className="w-10 h-10 text-surface-600 mx-auto mb-3" />
          <p className="text-surface-400 text-sm">No team members found</p>
        </div>
      )}

      {/* Add member modal */}
      <Modal
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        title={needsApproval ? "Request New Team Member" : "Add Team Member"}
        description={needsApproval ? "This request will be sent to your manager for approval" : "Add a new member directly to your team"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First Name" value={newMember.firstName} onChange={(e) => setNewMember({ ...newMember, firstName: e.target.value })} placeholder="John" required />
            <Input label="Last Name" value={newMember.lastName} onChange={(e) => setNewMember({ ...newMember, lastName: e.target.value })} placeholder="Doe" required />
          </div>
          <Input label="Email" type="email" value={newMember.email} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} placeholder="john@company.com" required />
          <Input label="Username" value={newMember.username} onChange={(e) => setNewMember({ ...newMember, username: e.target.value })} placeholder="johnd" required />
          <Select label="Role Level" value={newMember.roleLevelId} onChange={(e) => setNewMember({ ...newMember, roleLevelId: e.target.value })} required>
            <option value="">Select level...</option>
            {roleLevels
              .filter((rl) => (currentUser.isSuperAdmin ? true : rl.level > currentUser.level)) // Super admin can assign any level
              .map((rl) => <option key={rl.id} value={rl.id}>{rl.name}</option>)}
          </Select>
          <Select label="Reports To" value={newMember.parentId} onChange={(e) => setNewMember({ ...newMember, parentId: e.target.value })}>
            {users
              .filter((u) => (u.roleLevel?.level ?? 0) < (roleLevels.find((r) => r.id === newMember.roleLevelId)?.level ?? 999))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} — {u.roleLevel?.name ?? "No Role"}
                  {u.id === currentUser.userId ? " (me)" : ""}
                </option>
              ))}
          </Select>
          {needsApproval && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-400">
              ⚠ This request requires approval from your manager and above before the member is added.
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowAddMember(false)}>Cancel</Button>
            <Button className="flex-1" loading={addingMember} onClick={handleAddMember}>
              {needsApproval ? "Submit Request" : "Add Member"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Member detail modal */}
      <Modal isOpen={!!selectedUser} onClose={() => { setSelectedUser(null); setSelectedStats(null); }} size="sm">
        {selectedUser && (
          <div className="text-center space-y-4">
            <Avatar firstName={selectedUser.firstName} lastName={selectedUser.lastName} avatarUrl={selectedUser.avatarUrl} size="xl" className="mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-surface-100">
                {selectedUser.firstName} {selectedUser.lastName}
                {selectedUser.isSuperAdmin && <span className="ml-2 text-xs bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded-full">Super Admin</span>}
              </h3>
              <p className="text-sm text-surface-400">{selectedUser.email}</p>
              <p className="text-xs text-surface-500 mt-0.5">@{selectedUser.username}</p>
            </div>
            <div
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
              style={{
                backgroundColor: (selectedUser.roleLevel?.color ?? "#64748b") + "20",
                color: selectedUser.roleLevel?.color ?? "#64748b",
                borderColor: (selectedUser.roleLevel?.color ?? "#64748b") + "40",
                borderWidth: "1px",
                borderStyle: "solid",
              }}
            >
              {selectedUser.roleLevel?.name ?? "No Role"}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-surface-750 rounded-xl p-3">
                <p className="text-surface-500">Active Tasks</p>
                <p className="text-2xl font-bold text-surface-100 mt-0.5">
                  {selectedStats?.totals.open ?? selectedUser._count?.assignedTasks ?? 0}
                </p>
              </div>
              <div className="bg-surface-750 rounded-xl p-3">
                <p className="text-surface-500">Direct Reports</p>
                <p className="text-2xl font-bold text-surface-100 mt-0.5">{selectedUser._count?.children ?? 0}</p>
              </div>
            </div>

            {/* Task breakdown */}
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-4 text-left space-y-3">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-1.5">
                Task Overview
              </p>
              {loadingStats && (
                <p className="text-xs text-surface-500">Loading task stats…</p>
              )}
              {!loadingStats && selectedStats && (
                <>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div className="bg-surface-750 rounded-xl p-2.5">
                      <p className="text-surface-500">Total</p>
                      <p className="text-lg font-bold text-surface-100 mt-0.5">
                        {selectedStats.totals.total}
                      </p>
                    </div>
                    <div className="bg-surface-750 rounded-xl p-2.5">
                      <p className="text-surface-500">Completed</p>
                      <p className="text-lg font-bold text-emerald-400 mt-0.5">
                        {selectedStats.totals.completed}
                      </p>
                    </div>
                    <div className="bg-surface-750 rounded-xl p-2.5">
                      <p className="text-surface-500">Archived</p>
                      <p className="text-lg font-bold text-surface-200 mt-0.5">
                        {selectedStats.totals.archived}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 max-h-32 overflow-y-auto pr-1">
                    {Object.entries(selectedStats.byStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between text-[11px] text-surface-400">
                        <span className="uppercase tracking-widest">{status}</span>
                        <span className="font-semibold text-surface-200">{count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {currentUser.isSuperAdmin && (
              <div className="space-y-2">
                <div className="bg-surface-800 border border-surface-700 rounded-xl p-3 space-y-2 text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-surface-400">Role & Access</p>
                  <Select label="Role Level" value={selectedRoleLevelId} onChange={(e) => setSelectedRoleLevelId(e.target.value)}>
                    <option value="">No Role</option>
                    {roleLevels.map((rl) => (
                      <option key={rl.id} value={rl.id}>
                        {rl.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={savingRoleLevel}
                    onClick={() => handleSaveRoleLevel(selectedUser)}
                    className="w-full"
                  >
                    Save Role Level
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedUser.isSuperAdmin ? "outline" : "secondary"}
                    loading={updatingSuperAdmin}
                    onClick={() => handleToggleSuperAdmin(selectedUser)}
                    className="w-full"
                  >
                    {selectedUser.isSuperAdmin ? "Remove Super Admin" : "Make Super Admin"}
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={updatingQaAccess}
                  onClick={() => handleToggleQaAccess(selectedUser)}
                  className="w-full"
                >
                  {selectedUser.aiLeaderQaEnabled ? "Disable LeaderGPT Access" : "Enable LeaderGPT Access"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={regenLoading}
                  onClick={() => handleRegenerateCreds(selectedUser.id)}
                  className="w-full"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate Credentials
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* New member credentials modal (direct add flow) */}
      <Modal
        isOpen={!!newCreds}
        onClose={() => { setNewCreds(null); setShowPassword(false); }}
        title="New Member Credentials"
        description="Share these credentials with the new team member. They are shown once."
        size="sm"
      >
        {newCreds && (
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2 text-xs text-emerald-400">
              <Key className="w-4 h-4 flex-shrink-0" />
              Account created successfully.
            </div>

            <div className="space-y-3">
              {[
                { label: "Email", value: newCreds.email, mask: false },
                { label: "Username", value: newCreds.username, mask: false },
                { label: "Password", value: newCreds.password, mask: true },
              ].map(({ label, value, mask }) => (
                <div key={label} className="bg-surface-750 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-surface-500 mb-0.5">{label}</p>
                    <p className="text-sm font-mono text-surface-100 truncate">
                      {mask && !showPassword ? "•".repeat(value.length) : value}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {mask && (
                      <button
                        onClick={() => setShowPassword((s) => !s)}
                        className="text-surface-500 hover:text-surface-300 transition-colors p-1"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                    <button
                      onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copied`); }}
                      className="text-surface-500 hover:text-primary-400 transition-colors p-1"
                      title={`Copy ${label}`}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-surface-500 text-center">
              Keep these secure. Ask the member to change password after first login.
            </p>

            <Button
              className="w-full"
              onClick={() => { setNewCreds(null); setShowPassword(false); }}
            >
              Done
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function MemberCard({ user, currentUserId, roleColor, onClick }: { user: User; currentUserId: string; roleColor: string; onClick: () => void }) {
  const isMe = user.id === currentUserId;
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-surface-800 border border-surface-700 rounded-xl p-4 hover:border-surface-600 transition-all cursor-pointer group",
        isMe && "border-primary-500/30 bg-primary-500/5"
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar firstName={user.firstName} lastName={user.lastName} avatarUrl={user.avatarUrl} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-surface-100 truncate">
              {user.firstName} {user.lastName}
            </p>
            {user.isSuperAdmin && <Shield className="w-3 h-3 text-primary-400 flex-shrink-0" />}
            {isMe && <span className="text-[10px] text-primary-400 font-medium">(you)</span>}
          </div>
          <p className="text-xs text-surface-500 truncate">{user.email}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[10px] flex items-center gap-1 text-surface-500">
              <CheckSquare className="w-3 h-3" /> {user._count?.assignedTasks ?? 0} tasks
            </span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
      </div>
    </div>
  );
}
