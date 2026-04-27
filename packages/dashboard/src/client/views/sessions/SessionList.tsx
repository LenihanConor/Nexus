import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useDashboard } from "../../hooks.js";
import { formatDuration } from "@nexus/shared";
import type { SessionRecord } from "@nexus/shared";
import { SessionStatusBadge } from "./SessionStatusBadge.js";
import { SessionFilters, applyFilters, useSessionFilters } from "./SessionFilters.js";

const PAGE_SIZE = 20;

type SortKey = "created_at" | "status" | "duration_ms" | "project";

export function SessionList() {
  const { data } = useDashboard();
  const navigate = useNavigate();
  const { filters, setFilters, clearFilters, hasActiveFilters } = useSessionFilters();
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const agentTypes = useMemo(
    () => Array.from(new Set(data.sessions.map((s) => s.agent_type))).sort(),
    [data.sessions],
  );

  const filtered = useMemo(
    () => applyFilters(data.sessions, filters),
    [data.sessions, filters],
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "created_at":
          cmp = a.created_at.localeCompare(b.created_at);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "duration_ms":
          cmp = (a.duration_ms ?? 0) - (b.duration_ms ?? 0);
          break;
        case "project":
          cmp = a.project.localeCompare(b.project);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const staleSessions = data.sessions.filter((s) => s.status === "stale");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortAsc ? " ↑" : " ↓";
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Sessions</h2>

      {staleSessions.length > 0 && (
        <div className="bg-orange-900/20 border border-orange-800 rounded px-3 py-2 text-sm text-orange-300">
          {staleSessions.length} stale session{staleSessions.length !== 1 ? "s" : ""} detected.
          Run <code className="bg-gray-800 px-1 rounded">nexus session clean</code> to clean up.
        </div>
      )}

      <SessionFilters
        filters={filters}
        onChange={(f) => { setFilters(f); setPage(0); }}
        onClear={() => { clearFilters(); setPage(0); }}
        hasActive={hasActiveFilters}
        agentTypes={agentTypes}
      />

      {sorted.length === 0 ? (
        <p className="text-gray-600 text-sm py-8 text-center">
          {hasActiveFilters ? "No sessions match the current filters" : "No sessions found"}
        </p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-2 cursor-pointer hover:text-gray-300" onClick={() => toggleSort("status")}>
                  Status{sortIndicator("status")}
                </th>
                <th className="pb-2">Agent</th>
                <th className="pb-2 cursor-pointer hover:text-gray-300" onClick={() => toggleSort("project")}>
                  Project{sortIndicator("project")}
                </th>
                <th className="pb-2">Task</th>
                <th className="pb-2 cursor-pointer hover:text-gray-300" onClick={() => toggleSort("duration_ms")}>
                  Duration{sortIndicator("duration_ms")}
                </th>
                <th className="pb-2 cursor-pointer hover:text-gray-300" onClick={() => toggleSort("created_at")}>
                  Started{sortIndicator("created_at")}
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/sessions/${s.id}`)}
                  className="border-b border-gray-800/50 cursor-pointer hover:bg-gray-800/30"
                >
                  <td className="py-2"><SessionStatusBadge status={s.status} /></td>
                  <td className="py-2 text-gray-400">{s.agent_type}</td>
                  <td className="py-2 text-gray-400 font-mono text-xs">{s.project.split(/[/\\]/).pop()}</td>
                  <td className="py-2 text-gray-300 max-w-xs truncate">{s.task_description}</td>
                  <td className="py-2 text-gray-500">{s.duration_ms != null ? formatDuration(s.duration_ms) : "—"}</td>
                  <td className="py-2 text-gray-500 text-xs">{new Date(s.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{sorted.length} session{sorted.length !== 1 ? "s" : ""}</span>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                  className="px-2 py-1 rounded border border-gray-700 disabled:opacity-30 hover:bg-gray-800"
                >
                  Prev
                </button>
                <span>Page {currentPage + 1} of {totalPages}</span>
                <button
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setPage(currentPage + 1)}
                  className="px-2 py-1 rounded border border-gray-700 disabled:opacity-30 hover:bg-gray-800"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
