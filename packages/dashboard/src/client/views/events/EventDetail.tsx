import { useState } from "react";
import { Link } from "react-router";
import type { NexusEvent } from "@nexus/shared";

function isLinkableId(key: string): "session" | "worktree" | null {
  if (key === "session_id") return "session";
  if (key === "worktree_id") return "worktree";
  return null;
}

function JsonValue({ objKey, value }: { objKey: string; value: unknown }) {
  if (typeof value === "string") {
    const linkType = isLinkableId(objKey);
    if (linkType === "session") {
      return (
        <Link to={`/sessions/${value}`} className="text-blue-400 hover:text-blue-300">
          "{value}"
        </Link>
      );
    }
    if (linkType === "worktree") {
      return (
        <Link to="/worktrees" className="text-purple-400 hover:text-purple-300">
          "{value}"
        </Link>
      );
    }
    return <span className="text-green-400">"{value}"</span>;
  }
  if (typeof value === "number") return <span className="text-yellow-400">{value}</span>;
  if (typeof value === "boolean") return <span className="text-orange-400">{String(value)}</span>;
  if (value === null) return <span className="text-gray-500">null</span>;
  if (Array.isArray(value)) {
    return (
      <span>
        {"["}
        {value.map((item, i) => (
          <span key={i}>
            {i > 0 && ", "}
            <JsonValue objKey="" value={item} />
          </span>
        ))}
        {"]"}
      </span>
    );
  }
  return <span className="text-gray-400">{JSON.stringify(value)}</span>;
}

export function EventDetail({ event, onClose }: { event: NexusEvent; onClose: () => void }) {
  const payload = event.payload as Record<string, unknown>;
  const keys = Object.keys(payload);
  const isLarge = keys.length > 10;
  const [showAll, setShowAll] = useState(!isLarge);
  const visibleKeys = showAll ? keys : keys.slice(0, 10);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-mono text-blue-400">{event.event_type}</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xs">
          Collapse
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field label="ID" value={event.id} mono />
        <Field label="Timestamp" value={new Date(event.timestamp).toLocaleString()} />
        <Field label="Project" value={event.project || "(none)"} mono />
        {event.session_id ? (
          <div>
            <dt className="text-xs text-gray-500">Session</dt>
            <dd>
              <Link
                to={`/sessions/${event.session_id}`}
                className="text-xs font-mono text-blue-400 hover:text-blue-300"
              >
                {event.session_id.slice(0, 12)}...
              </Link>
            </dd>
          </div>
        ) : (
          <Field label="Session" value="(none)" />
        )}
        <Field label="Correlation" value={event.correlation_id.slice(0, 12) + "..."} mono />
        <Field label="User" value={event.user_id} />
      </div>

      <div>
        <h4 className="text-xs text-gray-500 uppercase mb-1">Payload</h4>
        <div className="bg-gray-800 rounded p-2 text-xs font-mono space-y-0.5 overflow-auto max-h-80">
          <div className="text-gray-400">{"{"}</div>
          {visibleKeys.map((key) => (
            <div key={key} className="ml-4">
              <span className="text-gray-500">{key}</span>
              <span className="text-gray-600">: </span>
              <JsonValue objKey={key} value={payload[key]} />
            </div>
          ))}
          {!showAll && isLarge && (
            <div className="ml-4">
              <button
                onClick={() => setShowAll(true)}
                className="text-blue-400 hover:text-blue-300"
              >
                ... {keys.length - 10} more fields
              </button>
            </div>
          )}
          <div className="text-gray-400">{"}"}</div>
        </div>
      </div>

      <div className="flex gap-2 text-xs">
        {event.session_id && (
          <Link
            to={`/sessions/${event.session_id}`}
            className="px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800"
          >
            View Session
          </Link>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`text-gray-300 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
