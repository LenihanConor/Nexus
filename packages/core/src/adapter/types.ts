export interface AgentAdapter {
  readonly agentType: string;
  start(opts: AdapterStartOpts): Promise<AdapterSession>;
  checkpoint(session: AdapterSession, snapshot: AdapterSnapshot): Promise<void>;
  end(session: AdapterSession, result: AdapterResult): Promise<void>;
}

export interface AdapterStartOpts {
  project: string;
  branch?: string;
  task: string;
  scope?: string[];
  parentSessionId?: string;
  correlationId?: string;
  noWorktree?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AdapterSession {
  sessionId: string;
  worktreeId: string | null;
  worktreePath: string | null;
  project: string;
  branch: string | null;
  agentType: string;
  agentPid?: number;
  startedAt: string;
}

export interface AdapterSnapshot {
  label: string;
  taskProgress?: string;
  filesChanged?: string[];
  decisions?: string[];
  tokenCount?: number;
  contextWindowPercent?: number;
  notes?: string;
}

export interface AdapterResult {
  status: "completed" | "failed" | "interrupted";
  exitCode?: number;
  mergeStrategy?: "merge" | "fast-forward" | "rebase" | "skip";
  snapshot?: AdapterSnapshot;
  metadata?: Record<string, unknown>;
}
