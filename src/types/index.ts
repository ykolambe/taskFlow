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
  /** Saved copy for Content Studio AI (optional). */
  contentBrandBrief?: string | null;
  contentBrandWebsite?: string | null;
  contentBrandCompetitorNotes?: string | null;
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
  /** @deprecated Use reportingLinksAsSubordinate; kept for legacy POST bodies */
  parentId?: string | null;
  /** Managers this user reports to; sortOrder 0 = primary org line */
  reportingLinksAsSubordinate?: { managerId: string; sortOrder: number }[];
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
  /** Default bootstrap super admin; excluded from team/org UX */
  isTenantBootstrapAccount?: boolean;
  aiLeaderQaEnabled?: boolean;
  chatAddonAccess?: boolean;
  recurringAddonAccess?: boolean;
  aiAddonAccess?: boolean;
  contentStudioAddonAccess?: boolean;
  isActive: boolean;
  createdAt: string;
  roleLevel: RoleLevel;
  parent?: UserBrief | null;
  children?: UserBrief[];
  _count?: {
    assignedTasks: number;
    reportingLinksAsManager?: number;
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
  parentId?: string | null;
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

export type CalendarType = "ORG" | "PERSONAL" | "CHANNEL";
export type CalendarEntryKind = "GOAL" | "MILESTONE" | "CONTENT";

export type ContentEntryStatus =
  | "IDEA"
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "READY_TO_PUBLISH"
  | "PUBLISHED"
  | "CANCELLED";

export interface CalendarCollection {
  id: string;
  companyId: string;
  ownerUserId: string | null;
  name: string;
  color: string;
  type: CalendarType;
  /** When type is CHANNEL, e.g. LinkedIn vs Instagram */
  contentChannel?: string | null;
  /** Preset platform id for AI (linkedin, instagram, …) */
  contentPlatformPreset?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEntry {
  id: string;
  companyId: string;
  calendarId: string;
  creatorId: string;
  title: string;
  notes: string | null;
  kind: CalendarEntryKind;
  color: string;
  startAt: string;
  endAt: string | null;
  isDone: boolean;
  contentStatus?: ContentEntryStatus | null;
  assigneeId?: string | null;
  url?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Approval ─────────────────────────────────────────────────────────────

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ApprovalRequest {
  id: string;
  companyId: string;
  requesterId: string;
  newUserData: ApprovalRequestPayload;
  approverChain: string[];
  status: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
  requester: UserBrief;
  approvals: ApprovalEntry[];
}

/** Stored on approval_requests.newUserData — add vs remove member. */
export type ApprovalRequestPayload = NewUserData | RemoveMemberPayload;

export interface RemoveMemberPayload {
  kind: "REMOVE";
  targetUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  roleLevelName: string;
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
  kind?: "ADD";
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  roleLevelId: string;
  roleLevelName: string;
  roleLevelLevel: number;
  parentId?: string;
  managerIds?: string[];
  password?: string;
}

export function isRemoveMemberPayload(
  data: ApprovalRequestPayload
): data is RemoveMemberPayload {
  return (data as RemoveMemberPayload).kind === "REMOVE";
}

// ─── Idea Board ───────────────────────────────────────────────────────────

export type IdeaStatus = "IDEA" | "THINKING" | "CONVERTED" | "DROPPED";
export interface IdeaTag {
  name: string;
  color: string;
}

export interface IdeaPage {
  id: string;
  title: string;
  content: string;
  sections?: IdeaPageSection[];
  updatedAt: string;
}

export interface IdeaPageSection {
  id: string;
  heading: string;
  section: string;
  notes: string;
}

export interface Idea {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  body: string | null;
  color: string;
  tags?: IdeaTag[];
  pages?: IdeaPage[];
  status: IdeaStatus;
  convertedTaskId: string | null;
  convertedTaskIds?: string[];
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
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
  author: UserBrief;
}

export type TaskRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface TaskRequest {
  id: string;
  companyId: string;
  requesterId: string;
  approverId: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: string | null;
  status: TaskRequestStatus;
  attachmentFileUrl: string | null;
  attachmentFileName: string | null;
  attachmentMimeType: string | null;
  attachmentFileSize: number | null;
  createdTaskId: string | null;
  approverAssigneeId: string | null;
  rejectComment: string | null;
  createdAt: string;
  updatedAt: string;
  requester: UserBrief;
  approver: UserBrief;
  createdTask?: { id: string; title: string; status: string } | null;
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
