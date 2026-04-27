import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useDashboard } from "../../hooks.js";
import { detectOverlaps } from "@nexus/shared";
import type { WorktreeRecord, OverlapReport } from "@nexus/shared";
import { WorktreeStatusBadge } from "./WorktreeStatusBadge.js";

type StatusFilter = "default" | "all" | string;

export function WorktreeList() {
  const { data } = useDashboard();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("default");
  const [showCleaned, setShowCleaned] = useState(false);

  const filtered = useMemo(() => {
    let result = data.worktrees;
    if (statusFilter === "default") {
      result = result.filter((w) => w.status !== "cleaned");
    } else if (statusFilter !== "all") {
      result = result.filter((w) => w.status === statusFilter);
    }
    if (!showCleaned && statusFilter !== "cleaned") {
      result = result.filter((w) => w.status !== "cleaned");
    }
    return result;
  }, [data.worktrees, statusFilter, showCleaned]);

  const grouped = useMemo(() => {
    const map = new Map<string, WorktreeRecord[]>();
    for (const w of filtered) {
      const list = map.get(w.project) ?? [];
      list.push(w);
      map.set(w.project, list);
    }
    const entries = Array.from(map.entries());
    entries.sort(([aProject, aWorktrees], [bProject, bWorktrees]) => {
      const aHasActive = aWorktrees.some((w) => w.status === "active");
      const bHasActive = bWorktrees.some((w) => w.status === "active");
      if (aHasActive !== bHasActive) return aHasActive ? -1 : 1;
      return aProject.localeCompare(bProject);
    });
    return entries;
  }, [filtered]);

  const overlaps = useMemo(() => detectOverlaps(data.worktrees), [data.worktrees]);
  const overlapsByWorktreeId = useMemo(() => {
    const map = new Map<string, OverlapReport[]>();
    for (const o of overlaps) {
      const listA = map.get(o.worktree_a.id) ?? [];
      listA.push(o);
      map.set(o.worktree_a.id, listA);
      const listB = map.get(o.worktree_b.id) ?? [];
      listB.push(o);
      map.set(o.worktree_b.id, listB);
    }
    return map;
  }, [overlaps]);

  const staleWorktrees = data.worktrees.filter((w) => w.status === "stale");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Worktrees</h2>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-800 text-gray-300 text-xs rounded px-2 py-1 border border-gray-700"
          >
            <option value="default">Active Statuses</option>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="merged">Merged</option>
            <option value="conflict">Conflict</option>
            <option value="stale">Stale</option>
            <option value="cleaned">Cleaned</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={showCleaned}
              onChange={(e) => setShowCleaned(e.target.checked)}
              className="rounded"
            />
            Show cleaned
          </label>
        </div>
      </div>

      {staleWorktrees.length > 0 && (
        <StaleWarningBanner stale={staleWorktrees} onFilter={() => setStatusFilter("stale")} />
      )}

      {grouped.length === 0 ? (
        <p className="text-gray-600 text-sm py-8 text-center">
          No worktrees active. When an agent starts work via Nexus, its isolated worktree will appear here.
        </p>
      ) : (
        grouped.map(([project, worktrees]) => (
          <ProjectGroup
            key={project}
            project={project}
            worktrees={worktrees}
            overlaps={overlapsByWorktreeId}
            onSelect={(id) => navigate(`/worktrees/${id}`)}
          />
        ))
      )}
    </div>
  );
}

function StaleWarningBanner({ stale, onFilter }: { stale: WorktreeRecord[]; onFilter: () => void }) {
  const collapsed = stale.length > 3;
  return (
    <div className="bg-orange-900/20 border border-orange-800 rounded px-3 py-2 text-sm text-orange-300">
      <div className="flex items-center justify-between">
        <span>
          {stale.length} stale worktree{stale.length !== 1 ? "s" : ""} need{stale.length === 1 ? "s" : ""} cleanup
        </span>
        <button onClick={onFilter} className="text-xs text-orange-400 hover:text-orange-200">
          View all
        </button>
      </div>
      {!collapsed && (
        <div className="mt-1 space-y-0.5 text-xs text-orange-400">
          {stale.map((w) => (
            <div key={w.id}>
              {w.branch} in {w.project.split(/[/\\]/).pop()} — session {w.session_id.slice(0, 8)}...
            </div>
          ))}
        </div>
      )}
      <div className="mt-1 text-xs text-gray-500">
        Clean up via: <code className="bg-gray-800 px-1 rounded">nexus worktree clean --stale</code>
      </div>
    </div>
  );
}

function ProjectGroup({
  project,
  worktrees,
  overlaps,
  onSelect,
}: {
  project: string;
  worktrees: WorktreeRecord[];
  overlaps: Map<string, OverlapReport[]>;
  onSelect: (id: string) => void;
}) {
  const hasActive = worktrees.some((w) => w.status === "active");
  const [expanded, setExpanded] = useState(hasActive);
  const projectOverlaps = worktrees.filter((w) => overlaps.has(w.id));
  const sorted = [...worktrees].sort((a, b) => {
    const order: Record<string, number> = { active: 0, conflict: 1, stale: 2, completed: 3, merged: 4, cleaned: 5 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.created_at.localeCompare(a.created_at);
  });

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2 bg-gray-900 flex items-center justify-between text-sm hover:bg-gray-800/50"
      >
        <span>
          <span className="text-gray-300 font-medium">{project.split(/[/\\]/).pop()}</span>
          <span className="text-gray-600 ml-2">({worktrees.length} worktree{worktrees.length !== 1 ? "s" : ""})</span>
        </span>
        <span className="text-gray-500">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="p-2 space-y-1">
          {projectOverlaps.length > 0 && (
            <div className="text-xs text-amber-400 bg-amber-900/20 rounded px-2 py-1 mb-1">
              {projectOverlaps.length} worktree{projectOverlaps.length !== 1 ? "s" : ""} ha{projectOverlaps.length === 1 ? "s" : "ve"} overlapping scope
            </div>
          )}

          {sorted.map((w) => {
            const wtOverlaps = overlaps.get(w.id) ?? [];
            return (
              <button
                key={w.id}
                onClick={() => onSelect(w.id)}
                className="w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-800/50 flex items-center gap-3"
              >
                <WorktreeStatusBadge status={w.status} />
                <span className="font-mono text-gray-300 text-xs">{w.branch}</span>
                <span className="text-gray-600 text-xs">{w.session_id.slice(0, 8)}...</span>
                {w.scope.length > 0 && (
                  <span className="text-gray-600 text-xs truncate">{w.scope.join(", ")}</span>
                )}
                {wtOverlaps.length > 0 && (
                  <span className="text-amber-400 text-xs flex-shrink-0">⚠ OVERLAP</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
