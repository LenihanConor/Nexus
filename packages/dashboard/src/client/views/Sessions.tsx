import { useState } from "react";
import { useDashboard } from "../hooks.js";
import { formatDuration } from "@nexus/shared";
import type { SessionRecord } from "@nexus/shared";

export function Sessions() {
  const { data } = useDashboard();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<SessionRecord | null>(null);

  const sessions = data.sessions.filter(
    (s) => statusFilter === "all" || s.status === statusFilter,
  );

  const sorted = [...sessions].sort(
    (a, b) => b.created_at.localeCompare(a.created_at),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sessions</h2>
        <StatusFilterSelect value={statusFilter} onChange={setStatusFilter} />
      </div>

      <div className="flex gap-4">
        <div className="flex-1 space-y-1">
          {sorted.length === 0 ? (
            <p className="text-gray-600 text-sm">No sessions found</p>
          ) : (
            sorted.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  selected?.id === s.id
                    ? "bg-gray-800 border border-gray-700"
                    : "hover:bg-gray-800/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">{s.task_description}</span>
                  <SessionStatusBadge status={s.status} />
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {s.agent_type} &middot; {new Date(s.created_at).toLocaleString()}
                  {s.duration_ms != null && ` &middot; ${formatDuration(s.duration_ms)}`}
                </div>
              </button>
            ))
          )}
        </div>

        {selected && (
          <div className="w-96 bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-white">{selected.task_description}</h3>
            <dl className="text-sm space-y-2">
              <Field label="ID" value={selected.id} mono />
              <Field label="Status" value={selected.status} />
              <Field label="Agent" value={selected.agent_type} />
              <Field label="Project" value={selected.project} mono />
              <Field label="Started" value={new Date(selected.created_at).toLocaleString()} />
              {selected.ended_at && (
                <Field label="Ended" value={new Date(selected.ended_at).toLocaleString()} />
              )}
              {selected.duration_ms != null && (
                <Field label="Duration" value={formatDuration(selected.duration_ms)} />
              )}
              {selected.parent_id && <Field label="Parent" value={selected.parent_id} mono />}
              <Field label="Correlation" value={selected.correlation_id} mono />
            </dl>

            {selected.snapshots.length > 0 && (
              <div>
                <h4 className="text-xs text-gray-500 uppercase mt-3 mb-1">Snapshots</h4>
                <div className="space-y-1">
                  {selected.snapshots.map((snap, i) => (
                    <div key={i} className="text-xs bg-gray-800 rounded px-2 py-1">
                      <span className="text-blue-400">{snap.label}</span>
                      {snap.task_progress && (
                        <span className="text-gray-500 ml-2">{snap.task_progress}</span>
                      )}
                    </div>
                  ))}
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

function StatusFilterSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-gray-800 text-gray-300 text-sm rounded px-2 py-1 border border-gray-700"
    >
      <option value="all">All Statuses</option>
      <option value="running">Running</option>
      <option value="completed">Completed</option>
      <option value="failed">Failed</option>
      <option value="paused">Paused</option>
      <option value="stale">Stale</option>
    </select>
  );
}

function SessionStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: "bg-green-900 text-green-300",
    completed: "bg-gray-800 text-gray-400",
    failed: "bg-red-900 text-red-300",
    paused: "bg-yellow-900 text-yellow-300",
    stale: "bg-orange-900 text-orange-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${colors[status] ?? "bg-gray-800 text-gray-400"}`}>
      {status}
    </span>
  );
}
