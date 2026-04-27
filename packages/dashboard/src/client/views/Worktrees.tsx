import { useState } from "react";
import { useDashboard } from "../hooks.js";
import type { WorktreeRecord } from "@nexus/shared";

export function Worktrees() {
  const { data } = useDashboard();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<WorktreeRecord | null>(null);

  const worktrees = data.worktrees.filter(
    (w) => statusFilter === "all" || w.status === statusFilter,
  );

  const sorted = [...worktrees].sort(
    (a, b) => b.created_at.localeCompare(a.created_at),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Worktrees</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-800 text-gray-300 text-sm rounded px-2 py-1 border border-gray-700"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="merged">Merged</option>
          <option value="conflict">Conflict</option>
          <option value="stale">Stale</option>
          <option value="cleaned">Cleaned</option>
        </select>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 space-y-1">
          {sorted.length === 0 ? (
            <p className="text-gray-600 text-sm">No worktrees found</p>
          ) : (
            sorted.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelected(w)}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  selected?.id === w.id
                    ? "bg-gray-800 border border-gray-700"
                    : "hover:bg-gray-800/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 font-mono">{w.branch}</span>
                  <WorktreeStatusBadge status={w.status} />
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {w.project.split(/[/\\]/).pop()} &middot; {new Date(w.created_at).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>

        {selected && (
          <div className="w-96 bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
            <h3 className="font-mono text-gray-300">{selected.branch}</h3>
            <dl className="text-sm space-y-2">
              <Field label="ID" value={selected.id} mono />
              <Field label="Status" value={selected.status} />
              <Field label="Project" value={selected.project} mono />
              <Field label="Parent Branch" value={selected.parent_branch} />
              <Field label="Path" value={selected.path} mono />
              <Field label="Session" value={selected.session_id} mono />
              <Field label="Created" value={new Date(selected.created_at).toLocaleString()} />
              {selected.merged_at && (
                <Field label="Merged" value={new Date(selected.merged_at).toLocaleString()} />
              )}
              {selected.cleaned_at && (
                <Field label="Cleaned" value={new Date(selected.cleaned_at).toLocaleString()} />
              )}
            </dl>

            {selected.scope.length > 0 && (
              <div>
                <h4 className="text-xs text-gray-500 uppercase mt-3 mb-1">Scope</h4>
                <div className="flex flex-wrap gap-1">
                  {selected.scope.map((s) => (
                    <span key={s} className="text-xs bg-gray-800 rounded px-2 py-0.5 font-mono text-gray-400">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selected.merge_result && (
              <div>
                <h4 className="text-xs text-gray-500 uppercase mt-3 mb-1">Merge Result</h4>
                <div className="text-xs bg-gray-800 rounded p-2 text-gray-300">
                  <div>{selected.merge_result.success ? "Success" : "Failed"}</div>
                  <div>{selected.merge_result.commits_merged} commits merged</div>
                  {selected.merge_result.conflicts.length > 0 && (
                    <div className="text-red-400">
                      Conflicts: {selected.merge_result.conflicts.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className={`text-gray-300 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function WorktreeStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-900 text-green-300",
    conflict: "bg-red-900 text-red-300",
    stale: "bg-orange-900 text-orange-300",
    merged: "bg-blue-900 text-blue-300",
    cleaned: "bg-gray-800 text-gray-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${colors[status] ?? "bg-gray-800 text-gray-400"}`}>
      {status}
    </span>
  );
}
