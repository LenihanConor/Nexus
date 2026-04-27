import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { SessionRecord, SessionStatus } from "@nexus/shared";

export interface SessionFilterValues {
  status: SessionStatus[];
  agent_type: string | null;
  from: string | null;
  to: string | null;
  search: string;
}

const ALL_STATUSES: SessionStatus[] = ["running", "paused", "completed", "failed", "interrupted", "stale"];

const TIME_PRESETS: { label: string; getValue: () => { from: string; to: string | null } | null }[] = [
  { label: "All", getValue: () => null },
  {
    label: "Today",
    getValue: () => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return { from: d.toISOString(), to: null };
    },
  },
  {
    label: "Last 7d",
    getValue: () => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { from: d.toISOString(), to: null };
    },
  },
  {
    label: "Last 30d",
    getValue: () => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return { from: d.toISOString(), to: null };
    },
  },
];

export function filtersToParams(f: SessionFilterValues): URLSearchParams {
  const p = new URLSearchParams();
  if (f.status.length > 0 && f.status.length < ALL_STATUSES.length) {
    p.set("status", f.status.join(","));
  }
  if (f.agent_type) p.set("agent_type", f.agent_type);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.search) p.set("search", f.search);
  return p;
}

export function paramsToFilters(p: URLSearchParams): SessionFilterValues {
  const statusParam = p.get("status");
  return {
    status: statusParam ? (statusParam.split(",") as SessionStatus[]) : [],
    agent_type: p.get("agent_type"),
    from: p.get("from"),
    to: p.get("to"),
    search: p.get("search") ?? "",
  };
}

export function applyFilters(sessions: SessionRecord[], filters: SessionFilterValues): SessionRecord[] {
  let result = sessions;
  if (filters.status.length > 0) {
    result = result.filter((s) => filters.status.includes(s.status));
  }
  if (filters.agent_type) {
    result = result.filter((s) => s.agent_type === filters.agent_type);
  }
  if (filters.from) {
    const from = filters.from;
    result = result.filter((s) => s.created_at >= from);
  }
  if (filters.to) {
    const to = filters.to;
    result = result.filter((s) => s.created_at <= to);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((s) => s.task_description.toLowerCase().includes(q));
  }
  return result;
}

export function useSessionFilters(): {
  filters: SessionFilterValues;
  setFilters: (f: SessionFilterValues) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => paramsToFilters(searchParams), [searchParams]);
  const hasActiveFilters = filters.status.length > 0 || !!filters.agent_type || !!filters.from || !!filters.to || !!filters.search;

  const setFilters = useCallback((f: SessionFilterValues) => {
    setSearchParams(filtersToParams(f), { replace: true });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  return { filters, setFilters, clearFilters, hasActiveFilters };
}

export function SessionFilters({
  filters,
  onChange,
  onClear,
  hasActive,
  agentTypes,
}: {
  filters: SessionFilterValues;
  onChange: (f: SessionFilterValues) => void;
  onClear: () => void;
  hasActive: boolean;
  agentTypes: string[];
}) {
  const [searchInput, setSearchInput] = useState(filters.search);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onChange({ ...filters, search: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const toggleStatus = (status: SessionStatus) => {
    const current = filters.status;
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onChange({ ...filters, status: next });
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => toggleStatus(s)}
            className={`px-2 py-0.5 rounded text-xs border ${
              filters.status.includes(s)
                ? "border-blue-500 bg-blue-900/30 text-blue-300"
                : "border-gray-700 text-gray-500 hover:text-gray-400"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <select
        value={filters.agent_type ?? ""}
        onChange={(e) => onChange({ ...filters, agent_type: e.target.value || null })}
        className="bg-gray-800 text-gray-300 text-xs rounded px-2 py-1 border border-gray-700"
      >
        <option value="">All Agents</option>
        {agentTypes.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>

      <div className="flex items-center gap-1">
        {TIME_PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => {
              const val = preset.getValue();
              onChange({ ...filters, from: val?.from ?? null, to: val?.to ?? null });
            }}
            className={`px-2 py-0.5 rounded text-xs border ${
              (!filters.from && !filters.to && preset.label === "All") ||
              (filters.from && preset.getValue()?.from === filters.from)
                ? "border-blue-500 bg-blue-900/30 text-blue-300"
                : "border-gray-700 text-gray-500 hover:text-gray-400"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Search tasks..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="bg-gray-800 text-gray-300 text-xs rounded px-2 py-1 border border-gray-700 w-40"
      />

      {hasActive && (
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
