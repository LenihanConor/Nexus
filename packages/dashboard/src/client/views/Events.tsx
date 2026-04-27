import { useState } from "react";
import { useDashboard } from "../hooks.js";
import { summarizeEvent } from "@nexus/shared";
import type { NexusEvent } from "@nexus/shared";

export function Events() {
  const { data } = useDashboard();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selected, setSelected] = useState<NexusEvent | null>(null);

  const eventTypes = Array.from(new Set(data.events.map((e) => e.event_type))).sort();

  const filtered = data.events.filter(
    (e) => typeFilter === "all" || e.event_type === typeFilter || e.event_type.startsWith(typeFilter + "."),
  );

  const sorted = [...filtered].sort(
    (a, b) => b.timestamp.localeCompare(a.timestamp),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Events</h2>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-gray-800 text-gray-300 text-sm rounded px-2 py-1 border border-gray-700"
        >
          <option value="all">All Types</option>
          <option value="session">Session</option>
          <option value="worktree">Worktree</option>
          <option value="audit">Audit</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 space-y-0.5">
          {sorted.length === 0 ? (
            <p className="text-gray-600 text-sm">No events found</p>
          ) : (
            sorted.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelected(e)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm flex items-center justify-between ${
                  selected?.id === e.id
                    ? "bg-gray-800 border border-gray-700"
                    : "hover:bg-gray-800/50"
                }`}
              >
                <div>
                  <span className="text-blue-400 font-mono text-xs">{e.event_type}</span>
                  <span className="text-gray-500 ml-2">{summarizeEvent(e)}</span>
                </div>
                <span className="text-gray-600 text-xs">
                  {new Date(e.timestamp).toLocaleTimeString()}
                </span>
              </button>
            ))
          )}
        </div>

        {selected && (
          <div className="w-96 bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
            <h3 className="font-mono text-blue-400 text-sm">{selected.event_type}</h3>
            <dl className="text-sm space-y-2">
              <Field label="ID" value={selected.id} mono />
              <Field label="Timestamp" value={new Date(selected.timestamp).toLocaleString()} />
              <Field label="Project" value={selected.project || "(none)"} mono />
              <Field label="Session" value={selected.session_id || "(none)"} mono />
              <Field label="Correlation" value={selected.correlation_id} mono />
              <Field label="User" value={selected.user_id} />
            </dl>
            <div>
              <h4 className="text-xs text-gray-500 uppercase mt-3 mb-1">Payload</h4>
              <pre className="text-xs bg-gray-800 rounded p-2 overflow-auto text-gray-300">
                {JSON.stringify(selected.payload, null, 2)}
              </pre>
            </div>
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
