export type ApprovalTier = "routine" | "constrained" | "standard" | "critical";

export interface ApprovalRule {
  tool: string;
  args_match?: string;
  tier: ApprovalTier;
}

export interface ApprovalProjectConfig {
  rules?: ApprovalRule[];
}

export interface ApprovalConfig {
  global: {
    default_tier: ApprovalTier;
    timeout_seconds: number;
    rules: ApprovalRule[];
  };
  projects: Record<string, ApprovalProjectConfig>;
}

export interface PendingApproval {
  id: string;
  session_id: string;
  project: string;
  tool: string;
  args: Record<string, unknown>;
  tier: ApprovalTier;
  requested_at: string;
  timeout_at: string | null;
}

export type ApprovalMethod = "auto" | "timeout" | "human";

export interface ApprovalDecision {
  approved: boolean;
  method: ApprovalMethod;
  decided_at: string;
  reason?: string;
}

export interface ResolvedApproval {
  approved: boolean;
  reason?: string;
  resolved_at: string;
}
