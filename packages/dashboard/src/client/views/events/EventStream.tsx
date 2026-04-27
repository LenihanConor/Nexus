import { useState, useMemo, useRef, useEffect } from "react";
import { useDashboard } from "../../hooks.js";
import { summarizeEvent } from "@nexus/shared";
import type { NexusEvent } from "@nexus/shared";
import { EventTypeIcon } from "./EventTypeIcon.js";
import { EventFilters, applyEventFilters, useEventFilters } from "./EventFilters.js";
import { EventDetail } from "./EventDetail.js";

const PAGE_SIZE = 50;

export function EventStream() {
  const { data } = useDashboard();
  const { filters, setFilters, clearFilters, hasActiveFilters } = useEventFilters();
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [liveTail, setLiveTail] = useState(false);
  const [prevEventCount, setPrevEventCount] = useState(0);
  const [newEventCount, setNewEventCount] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => applyEventFilters(data.events, filters),
    [data.events, filters],
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const cmp = a.timestamp.localeCompare(b.timestamp);
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortAsc]);

  useEffect(() => {
    if (prevEventCount > 0 && sorted.length > prevEventCount) {
      const diff = sorted.length - prevEventCount;
      if (liveTail) {
        listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setNewEventCount((c) => c + diff);
      }
    }
    setPrevEventCount(sorted.length);
  }, [sorted.length]);

  const totalPages = liveTail ? 1 : Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = liveTail ? sorted : sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const scrollToNew = () => {
    setNewEventCount(0);
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleLiveTail = () => {
    const next = !liveTail;
    setLiveTail(next);
    if (next) {
      setNewEventCount(0);
      setPage(0);
      listRef.current?.scrollTo({ top: 0 });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Events</h2>
        <button
          onClick={toggleLiveTail}
          className={`px-3 py-1 rounded text-xs border ${
            liveTail
              ? "border-green-500 bg-green-900/30 text-green-300"
              : "border-gray-700 text-gray-500 hover:text-gray-400"
          }`}
        >
          Live Tail: {liveTail ? "ON" : "OFF"}
        </button>
      </div>

      <EventFilters
        filters={filters}
        onChange={(f) => { setFilters(f); setPage(0); }}
        onClear={() => { clearFilters(); setPage(0); }}
        hasActive={hasActiveFilters}
      />

      {!liveTail && newEventCount > 0 && (
        <button
          onClick={scrollToNew}
          className="w-full text-center text-xs text-blue-400 hover:text-blue-300 py-1 bg-blue-900/20 border border-blue-800 rounded"
        >
          &uarr; {newEventCount} new event{newEventCount !== 1 ? "s" : ""}
        </button>
      )}

      {sorted.length === 0 ? (
        <p className="text-gray-600 text-sm py-8 text-center">
          {hasActiveFilters ? "No events match the current filters" : "No events found"}
        </p>
      ) : (
        <>
          <div ref={listRef} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>{sorted.length} event{sorted.length !== 1 ? "s" : ""}</span>
              <button
                onClick={() => setSortAsc(!sortAsc)}
                className="hover:text-gray-300"
              >
                {sortAsc ? "Oldest first ↑" : "Newest first ↓"}
              </button>
            </div>

            {paginated.map((e) => (
              <div key={e.id}>
                <button
                  onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-3 ${
                    expandedId === e.id
                      ? "bg-gray-800 border border-gray-700"
                      : "hover:bg-gray-800/50"
                  }`}
                >
                  <span className="text-gray-500 text-xs font-mono whitespace-nowrap">
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </span>
                  <EventTypeIcon eventType={e.event_type} />
                  <span className="text-gray-400 font-mono text-xs">{e.event_type}</span>
                  <span className="text-gray-500 text-xs truncate flex-1">{summarizeEvent(e)}</span>
                  <span className="text-gray-600 text-xs whitespace-nowrap">
                    {e.project.split(/[/\\]/).pop()}
                  </span>
                </button>
                {expandedId === e.id && (
                  <div className="ml-4 mt-1 mb-2">
                    <EventDetail event={e} onClose={() => setExpandedId(null)} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {!liveTail && totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{sorted.length} event{sorted.length !== 1 ? "s" : ""}</span>
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
