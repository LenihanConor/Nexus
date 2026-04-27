export type SessionStatus =
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "interrupted"
  | "stale";

export interface SessionSnapshot {
  timestamp: string;
  label: string;
  task_progress: string | null;
  decisions: string[];
  files_changed: string[];
  notes: string | null;
}

export interface SessionRecord {
  id: string;
  parent_id: string | null;
  project: string;
  correlation_id: string;
  agent_type: string;
  agent_pid: number | null;
  user_id: string;
  task_description: string;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
  exit_code: number | null;
  duration_ms: number | null;
  snapshots: SessionSnapshot[];
  metadata: Record<string, unknown>;
}

export interface SessionLineage {
  root: SessionRecord;
  path_to_target: SessionRecord[];
  children: SessionRecord[];
  descendants: SessionRecord[];
}

export interface SessionTreeNode {
  session: SessionRecord;
  children: SessionTreeNode[];
}
