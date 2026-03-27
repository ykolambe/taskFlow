export type { PlatformTokenPayload, TenantTokenPayload, TokenPayload } from "@/lib/auth";

// ─── API Response ─────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── Company ──────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  domain: string | null;
  isActive: boolean;
  modules: string[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
    tasks: number;
  };
}

// ─── Role Level ───────────────────────────────────────────────────────────

export interface RoleLevel {
  id: string;
  companyId: string;
  name: string;
  level: number;
  color: string;
  canApprove: boolean;
}

// ─── User ─────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  companyId: string;
  roleLevelId: string;
  parentId: string | null;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  roleLevel: RoleLevel;
  parent?: UserBrief | null;
  children?: UserBrief[];
  _count?: {
    assignedTasks: number;
    children: number;
  };
}

export interface UserBrief {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  roleLevelId: string;
  roleLevel: RoleLevel;
  isSuperAdmin: boolean;
}

// ─── Task ─────────────────────────────────────────────────────────────────

export type TaskStatus = string; // Dynamic per-company status key
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Task {
  id: string;
  companyId: string;
  creatorId: string;
  assigneeId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  completedAt: string | null;
  isArchived: boolean;
  recurringId: string | null;
  createdAt: string;
  updatedAt: string;
  creator: UserBrief;
  assignee: UserBrief;
  attachments?: Attachment[];
}

// ─── Recurring Task ───────────────────────────────────────────────────────

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY";

export interface RecurringAttachmentTemplate {
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export interface RecurringTask {
  id: string;
  companyId: string;
  creatorId: string;
  assigneeId: string;
  title: string;
  description: string | null;
  priority: Priority;
  frequency: Frequency;
  daysOfWeek: number[];
  dayOfMonth: number | null;
  startDate: string;
  endDate: string | null;
  templateAttachments?: RecurringAttachmentTemplate[];
  isActive: boolean;
  lastGenerated: string | null;
  nextDue: string | null;
  createdAt: string;
  creator: UserBrief;
  assignee: UserBrief;
}

// ─── Approval ─────────────────────────────────────────────────────────────

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ApprovalRequest {
  id: string;
  companyId: string;
  requesterId: string;
  newUserData: NewUserData;
  approverChain: string[];
  status: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
  requester: UserBrief;
  approvals: ApprovalEntry[];
}

export interface ApprovalEntry {
  id: string;
  requestId: string;
  approverId: string;
  status: ApprovalStatus;
  comment: string | null;
  createdAt: string;
  approver: UserBrief;
}

export interface NewUserData {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  roleLevelId: string;
  roleLevelName: string;
  roleLevelLevel: number;
  parentId: string;
  password?: string;
}

// ─── Idea Board ───────────────────────────────────────────────────────────

export type IdeaStatus = "IDEA" | "THINKING" | "CONVERTED" | "DROPPED";

export interface Idea {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  body: string | null;
  color: string;
  status: IdeaStatus;
  convertedTaskId: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Task Comment ─────────────────────────────────────────────────────────

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: UserBrief;
}

// ─── Attachment ───────────────────────────────────────────────────────────

export interface Attachment {
  id: string;
  taskId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploaderId: string;
  createdAt: string;
}

// ─── Org Tree ─────────────────────────────────────────────────────────────

export interface OrgNode {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  roleLevel: RoleLevel;
  isSuperAdmin: boolean;
  isActive: boolean;
  children: OrgNode[];
}
