export type BriefConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface BriefRisk {
  title: string;
  why: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

export interface BriefDecision {
  decision: string;
  impact: string;
  recommendedOwner: string;
}

export interface ExecutiveBrief {
  summary: string;
  whatChanged: string[];
  topRisks: BriefRisk[];
  decisionsNeeded: BriefDecision[];
  next7Days: string[];
  confidence: BriefConfidence;
  sourceNote: string;
}

export interface ExecutiveBriefResponse {
  brief: ExecutiveBrief;
  source: "ai" | "fallback";
  generatedAt: string;
}

export interface ExecutiveBriefContext {
  companyName: string;
  generatedAt: string;
  leader: {
    userId: string;
    firstName: string;
    lastName: string;
    level: number;
    isSuperAdmin: boolean;
  };
  metrics: {
    visibleTeamSize: number;
    directReports: number;
    openTasks: number;
    overdueTasks: number;
    highPriorityOpen: number;
    pendingApprovals: number;
    remindersDueNext7Days: number;
    remindersOverdue: number;
    newTasksLast24h: number;
    completedLast24h: number;
  };
  priorityMix: Array<{ priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; count: number }>;
  hotspots: Array<{
    userId: string;
    name: string;
    role: string;
    openTasks: number;
    overdueTasks: number;
    urgentTasks: number;
  }>;
}

export interface LeaderQaMetric {
  key: string;
  label: string;
  value: number | string;
  window: string;
  source: string;
}

export interface LeaderQaAnswer {
  answer: string;
  topDrivers: string[];
  actions: string[];
  confidence: BriefConfidence;
  citations: string[];
}

export interface LeaderQaResponse {
  result: LeaderQaAnswer & { metrics: LeaderQaMetric[] };
  source: "ai" | "fallback";
  generatedAt: string;
}
