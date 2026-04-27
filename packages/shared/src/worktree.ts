export type WorktreeStatus =
  | "active"
  | "completed"
  | "merged"
  | "conflict"
  | "stale"
  | "cleaned";

export interface MergeResult {
  success: boolean;
  conflicts: string[];
  commits_merged: number;
}

export interface WorktreeRecord {
  id: string;
  session_id: string;
  project: string;
  branch: string;
  parent_branch: string;
  path: string;
  scope: string[];
  status: WorktreeStatus;
  created_at: string;
  merged_at: string | null;
  cleaned_at: string | null;
  merge_result: MergeResult | null;
}

export interface ConflictReport {
  has_conflicts: boolean;
  conflicts: Array<{
    worktree_id: string;
    session_id: string;
    branch: string;
    overlapping_paths: string[];
  }>;
}
