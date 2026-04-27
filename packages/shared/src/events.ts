export interface EventPayloadMap {
  "audit.started": { version: string };
  "audit.cleanup": {
    files_deleted: string[];
    files_skipped: string[];
    oldest_retained: string;
  };
  "session.started": {
    parent_id: string | null;
    agent_type: string;
    task_description: string;
  };
  "session.updated": { status: string; snapshot_label?: string };
  "session.ended": {
    status: string;
    exit_code: number | null;
    duration_ms: number;
  };
  "worktree.created": {
    worktree_id: string;
    branch: string;
    parent_branch: string;
    path: string;
    scope: string[];
  };
  "worktree.conflict_detected": {
    worktree_id: string;
    conflicting_session_id: string;
    overlapping_paths: string[];
  };
  "worktree.merged": {
    worktree_id: string;
    branch: string;
    merge_result: {
      success: boolean;
      conflicts: string[];
      commits_merged: number;
    };
  };
  "worktree.merge_failed": {
    worktree_id: string;
    branch: string;
    conflicts: string[];
  };
  "worktree.stale_detected": {
    worktree_id: string;
    session_id: string;
    branch: string;
  };
  "worktree.cleaned": {
    worktree_id: string;
    branch: string;
    path: string;
  };
  "budget.usage_recorded": {
    session_id: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_creation_tokens: number;
    estimated_cost_usd: number;
  };
  "budget.threshold_reached": {
    session_id: string;
    project: string;
    spent_usd: number;
    soft_cap_usd: number;
    period: string;
  };
  "budget.cap_exceeded": {
    session_id: string;
    project: string;
    spent_usd: number;
    hard_cap_usd: number;
    period: string;
  };
  "budget.reset": {
    project: string;
    period: string;
  };
  "context.warn": {
    session_id: string;
    context_window_percent: number;
    threshold: number;
  };
  "context.critical": {
    session_id: string;
    context_window_percent: number;
    threshold: number;
  };
  "approval.requested": {
    session_id: string;
    approval_id: string;
    tool: string;
    tier: string;
    timeout_at: string | null;
  };
  "approval.auto_approved": {
    session_id: string;
    tool: string;
    tier: string;
  };
  "approval.timeout_approved": {
    session_id: string;
    approval_id: string;
    tool: string;
  };
  "approval.human_approved": {
    session_id: string;
    approval_id: string;
    tool: string;
  };
  "approval.rejected": {
    session_id: string;
    approval_id: string;
    tool: string;
    reason: string | null;
  };
  [key: string]: Record<string, unknown>;
}

export interface NexusEvent<T extends string = string> {
  id: string;
  timestamp: string;
  event_type: T;
  project: string;
  session_id: string | null;
  correlation_id: string;
  agent_id: string | null;
  user_id: string;
  payload: T extends keyof EventPayloadMap ? EventPayloadMap[T] : Record<string, unknown>;
}

export const KNOWN_EVENT_TYPES = [
  "audit.started",
  "audit.cleanup",
  "session.started",
  "session.updated",
  "session.ended",
  "worktree.created",
  "worktree.conflict_detected",
  "worktree.merged",
  "worktree.merge_failed",
  "worktree.stale_detected",
  "worktree.cleaned",
  "budget.usage_recorded",
  "budget.threshold_reached",
  "budget.cap_exceeded",
  "budget.reset",
  "context.warn",
  "context.critical",
  "approval.requested",
  "approval.auto_approved",
  "approval.timeout_approved",
  "approval.human_approved",
  "approval.rejected",
] as const;

export type KnownEventType = (typeof KNOWN_EVENT_TYPES)[number];
