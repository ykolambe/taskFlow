"use client";

import { useState, useEffect } from "react";
import { GitBranch, ZoomIn, ZoomOut, Shield, CheckSquare, Building2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { OrgNode } from "@/types";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Props {
  orgTree: OrgNode[];
  superAdmins?: OrgNode[];
  currentUserId: string;
  companyName: string;
  companyLogoUrl?: string | null;
  slug: string;
}

export default function OrgChart({ orgTree, superAdmins = [], currentUserId, companyName, companyLogoUrl, slug }: Props) {
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<OrgNode | null>(null);
  const [stats, setStats] = useState<{
    totals: { total: number; open: number; completed: number; archived: number };
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      if (!selected) {
        setStats(null);
        return;
      }
      setLoadingStats(true);
      try {
        const res = await fetch(`/api/t/${slug}/users/${selected.id}/task-stats`);
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to load task stats");
          setStats(null);
          return;
        }
        setStats(data.data);
      } catch {
        toast.error("Failed to load task stats");
        setStats(null);
      } finally {
        setLoadingStats(false);
      }
    };
    loadStats();
  }, [selected, slug]);

  if (orgTree.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 sm:px-6 py-4 border-b border-surface-800 flex-shrink-0">
          <h1 className="text-xl font-bold text-surface-100">Org Chart</h1>
          <p className="text-surface-400 text-xs mt-0.5">{companyName} hierarchy</p>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 py-12 px-4">
          <div className="inline-flex flex-col items-center rounded-2xl border-2 border-primary-500/40 bg-gradient-to-b from-surface-800 to-surface-850 px-5 py-4 shadow-lg shadow-primary-900/20 min-w-[160px] max-w-[280px] mb-8">
            <div className="relative mb-3">
              {companyLogoUrl ? (
                <img
                  src={companyLogoUrl}
                  alt=""
                  className="w-16 h-16 rounded-xl object-cover border border-surface-600 bg-surface-900"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-2xl shadow-inner border border-primary-400/30">
                  {companyName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-surface-800 border border-surface-600 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-primary-400" />
              </div>
            </div>
            <p className="text-sm font-bold text-surface-100 text-center leading-tight tracking-tight">{companyName}</p>
            <p className="text-[10px] text-surface-500 mt-1 uppercase tracking-widest">Organization</p>
          </div>
          <GitBranch className="w-12 h-12 text-surface-600 mb-3" />
          <p className="text-surface-400 font-medium">No organization chart yet</p>
          <p className="text-surface-600 text-sm mt-1 text-center">Add team members to build the hierarchy</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-surface-800 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-surface-100">Org Chart</h1>
          <p className="text-surface-400 text-xs mt-0.5">{companyName} hierarchy</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            className="p-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-400 hover:text-surface-200 transition-all"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-surface-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
            className="p-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-400 hover:text-surface-200 transition-all"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-xs text-surface-400 hover:text-surface-200 transition-all"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 overflow-auto p-6">
        <div
          className={cn(
            "org-tree org-tree-with-company flex flex-col items-center",
            orgTree.length > 0 && "company-root"
          )}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            transition: "transform 0.2s ease",
            minWidth: "fit-content",
          }}
        >
          {orgTree.length > 0 && (
            <div className="flex flex-col items-center w-full mb-0">
              <div className="flex items-start justify-center gap-6 mb-2">
                <div className="inline-flex flex-col items-center rounded-2xl border-2 border-primary-500/40 bg-gradient-to-b from-surface-800 to-surface-850 px-5 py-4 shadow-lg shadow-primary-900/20 min-w-[160px] max-w-[280px]">
                  <div className="relative mb-3">
                    {companyLogoUrl ? (
                      <img
                        src={companyLogoUrl}
                        alt=""
                        className="w-16 h-16 rounded-xl object-cover border border-surface-600 bg-surface-900"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-2xl shadow-inner border border-primary-400/30">
                        {companyName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-surface-800 border border-surface-600 flex items-center justify-center">
                      <Building2 className="w-3.5 h-3.5 text-primary-400" />
                    </div>
                  </div>
                  <p className="text-sm font-bold text-surface-100 text-center leading-tight tracking-tight">{companyName}</p>
                  <p className="text-[10px] text-surface-500 mt-1 uppercase tracking-widest">Organization</p>
                </div>
                {superAdmins.length > 0 && (
                  <div className="min-w-[180px] max-w-[240px] rounded-xl border border-surface-700 bg-surface-800/70 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-surface-500 mb-2">Super Admins</p>
                    <div className="space-y-2">
                      {superAdmins.map((admin) => (
                        <button
                          key={admin.id}
                          type="button"
                          onClick={() => setSelected(admin)}
                          className="w-full flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-800 px-2 py-1.5 hover:border-primary-500/50 transition-all text-left"
                        >
                          <Avatar firstName={admin.firstName} lastName={admin.lastName} avatarUrl={admin.avatarUrl} size="xs" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-surface-100 truncate">
                              {admin.firstName} {admin.lastName}
                            </p>
                            <p className="text-[10px] text-surface-500 truncate">{admin.roleLevel.name}</p>
                          </div>
                          <Shield className="w-3 h-3 text-primary-400 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="h-5 w-px bg-surface-600 flex-shrink-0" aria-hidden />
            </div>
          )}
          <ul className="org-tree-siblings w-full">
            {orgTree.map((node) => (
              <OrgNodeComponent
                key={node.id}
                node={node}
                currentUserId={currentUserId}
                onSelect={setSelected}
              />
            ))}
          </ul>
        </div>
      </div>

      {/* Node detail panel */}
      {selected && (
        <div className="border-t border-surface-800 p-4 bg-surface-900 flex-shrink-0">
          <div className="flex items-center gap-4 max-w-lg">
            <Avatar
              firstName={selected.firstName}
              lastName={selected.lastName}
              avatarUrl={selected.avatarUrl}
              size="lg"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-surface-100">
                  {selected.firstName} {selected.lastName}
                </h3>
                {selected.isSuperAdmin && <Shield className="w-3.5 h-3.5 text-primary-400" />}
                {selected.id === currentUserId && (
                  <span className="text-xs text-primary-400 font-medium">(you)</span>
                )}
              </div>
              <p className="text-xs text-surface-400">{selected.email}</p>
              <div
                className="inline-flex items-center mt-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: selected.roleLevel.color + "20",
                  color: selected.roleLevel.color,
                  border: `1px solid ${selected.roleLevel.color}40`,
                }}
              >
                {selected.roleLevel.name}
              </div>
            </div>
            <div className="text-center space-y-1">
              <div>
                <p className="text-xs text-surface-500">Direct Reports</p>
                <p className="text-2xl font-bold text-surface-100">{selected.children.length}</p>
              </div>
              <div className="mt-2 bg-surface-800 rounded-xl px-3 py-2 text-xs text-surface-400 flex items-center gap-2">
                <CheckSquare className="w-3.5 h-3.5 text-primary-400" />
                {loadingStats ? (
                  <span>Loading tasks…</span>
                ) : stats ? (
                  <span>
                    {stats.totals.completed} / {stats.totals.total} completed
                  </span>
                ) : (
                  <span>No data</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrgNodeComponent({
  node,
  currentUserId,
  onSelect,
  depth = 0,
}: {
  node: OrgNode;
  currentUserId: string;
  onSelect: (node: OrgNode) => void;
  depth?: number;
}) {
  const isMe = node.id === currentUserId;

  return (
    <li>
      {/* Node card */}
      <div
        onClick={() => onSelect(node)}
        className={cn(
          "inline-flex flex-col items-center p-3 rounded-xl border cursor-pointer transition-all hover:scale-105 min-w-[120px] max-w-[140px]",
          isMe
            ? "bg-primary-500/15 border-primary-500/50 shadow-lg shadow-primary-500/20"
            : "bg-surface-800 border-surface-700 hover:border-surface-500"
        )}
        style={{
          borderTop: `3px solid ${node.roleLevel.color}`,
        }}
      >
        <Avatar
          firstName={node.firstName}
          lastName={node.lastName}
          avatarUrl={node.avatarUrl}
          size="sm"
          className="mb-2"
        />
        <p className={cn("text-xs font-semibold text-center truncate w-full", isMe ? "text-primary-300" : "text-surface-100")}>
          {node.firstName}
        </p>
        <p className="text-[10px] text-surface-500 truncate w-full text-center">{node.lastName}</p>
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1.5"
          style={{
            backgroundColor: node.roleLevel.color + "20",
            color: node.roleLevel.color,
          }}
        >
          {node.roleLevel.name}
        </span>
        {node.isSuperAdmin && (
          <Shield className="w-3 h-3 text-primary-400 mt-1" />
        )}
      </div>

      {/* Children */}
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <OrgNodeComponent
              key={child.id}
              node={child}
              currentUserId={currentUserId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
