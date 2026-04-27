import type { NexusEvent } from "./events.js";

export function summarizeEvent(event: NexusEvent): string {
  const p = event.payload as Record<string, unknown>;

  switch (event.event_type) {
    case "audit.started":
      return `v${p.version}`;
    case "audit.cleanup":
      return `${(p.files_deleted as string[])?.length ?? 0} files deleted`;
    case "session.started":
      return String(p.task_description ?? "");
    case "session.updated":
      return String(p.status ?? "");
    case "session.ended":
      return `${p.status} (${p.duration_ms}ms)`;
    case "worktree.created":
      return String(p.branch ?? "");
    case "worktree.conflict_detected":
      return `${(p.overlapping_paths as string[])?.length ?? 0} paths`;
    case "worktree.merged":
      return String(p.branch ?? "");
    case "worktree.merge_failed":
      return `${p.branch}: ${(p.conflicts as string[])?.length ?? 0} conflicts`;
    case "worktree.stale_detected":
      return String(p.branch ?? "");
    case "worktree.cleaned":
      return String(p.branch ?? "");
    default:
      return JSON.stringify(p).slice(0, 60);
  }
}
