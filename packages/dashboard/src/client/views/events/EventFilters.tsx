import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { KNOWN_EVENT_TYPES } from "@nexus/shared";
import { EVENT_CATEGORIES, eventCategory } from "./EventTypeIcon.js";

export interface EventFilterValues {
  event_type: string | null;
  session_id: string | null;
  correlation_id: string | null;
  from: string | null;
  to: string | null;
  search: string;
}

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

export function eventFiltersToParams(f: EventFilterValues): URLSearchParams {
  const p = new URLSearchParams();
  if (f.event_type) p.set("type", f.event_type);
  if (f.session_id) p.set("session", f.session_id);
  if (f.correlation_id) p.set("correlation", f.correlation_id);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.search) p.set("search", f.search);
  return p;
}

export function eventParamsToFilters(p: URLSearchParams): EventFilterValues {
  return {
    event_type: p.get("type"),
    session_id: p.get("session"),
    correlation_id: p.get("correlation"),
    from: p.get("from"),
    to: p.get("to"),
    search: p.get("search") ?? "",
  };
}

import type { NexusEvent } from "@nexus/shared";
import { summarizeEvent } from "@nexus/shared";

export function applyEventFilters(events: NexusEvent[], filters: EventFilterValues): NexusEvent[] {
  let result = events;
  if (filters.event_type) {
    const t = filters.event_type;
    if (EVENT_CATEGORIES.includes(t as typeof EVENT_CATEGORIES[number])) {
      result = result.filter((e) => eventCategory(e.event_type) === t);
    } else {
      result = result.filter((e) => e.event_type === t);
    }
  }
  if (filters.session_id) {
    const sid = filters.session_id;
    result = result.filter((e) => e.session_id === sid);
  }
  if (filters.correlation_id) {
    const cid = filters.correlation_id;
    result = result.filter((e) => e.correlation_id === cid);
  }
  if (filters.from) {
    const from = filters.from;
    result = result.filter((e) => e.timestamp >= from);
  }
  if (filters.to) {
    const to = filters.to;
    result = result.filter((e) => e.timestamp <= to);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((e) =>
      e.event_type.toLowerCase().includes(q) || summarizeEvent(e).toLowerCase().includes(q),
    );
  }
  return result;
}

export function useEventFilters(): {
  filters: EventFilterValues;
  setFilters: (f: EventFilterValues) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => eventParamsToFilters(searchParams), [searchParams]);
  const hasActiveFilters =
    !!filters.event_type || !!filters.session_id || !!filters.correlation_id ||
    !!filters.from || !!filters.to || !!filters.search;

  const setFilters = useCallback((f: EventFilterValues) => {
    setSearchParams(eventFiltersToParams(f), { replace: true });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  return { filters, setFilters, clearFilters, hasActiveFilters };
}

export function EventFilters({
  filters,
  onChange,
  onClear,
  hasActive,
}: {
  filters: EventFilterValues;
  onChange: (f: EventFilterValues) => void;
  onClear: () => void;
  hasActive: boolean;
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

  const groupedTypes = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const t of KNOWN_EVENT_TYPES) {
      const cat = eventCategory(t);
      (groups[cat] ??= []).push(t);
    }
    return groups;
  }, []);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select
        value={filters.event_type ?? ""}
        onChange={(e) => onChange({ ...filters, event_type: e.target.value || null })}
        className="bg-gray-800 text-gray-300 text-xs rounded px-2 py-1 border border-gray-700"
      >
        <option value="">All Types</option>
        {Object.entries(groupedTypes).map(([cat, types]) => (
          <optgroup key={cat} label={cat}>
            <option value={cat}>All {cat} events</option>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </optgroup>
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
        placeholder="Search events..."
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
