import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useDashboard } from "../../hooks.js";
import { formatDuration, summarizeEvent } from "@nexus/shared";
import type { SessionRecord, SessionSnapshot, NexusEvent, WorktreeRecord } from "@nexus/shared";
import { SessionStatusBadge } from "./SessionStatusBadge.js";

const MAX_VISIBLE_SNAPSHOTS = 10;
const MAX_RECENT_EVENTS = 20;

function getSessionDetail(
  sessions: SessionRecord[],
  worktrees: WorktreeRecord[],
  events: NexusEvent[],
  sessionId: string,
): { session: SessionRecord; worktree: WorktreeRecord | null; events: NexusEvent[] } | null {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const worktree = worktrees.find((w) => w.session_id === sessionId) ?? null;
  const sessionEvents = events
    .filter((e) => e.session_id === sessionId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, MAX_RECENT_EVENTS);
  return { session, worktree, events: sessionEvents };
}

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { data } = useDashboard();
  const navigate = useNavigate();

  const detail = useMemo(
    () => (id ? getSessionDetail(data.sessions, data.worktrees, data.events, id) : null),
    [data.sessions, data.worktrees, data.events, id],
  );

  if (!detail) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-gray-400">Session not found</p>
        <Link to="/sessions" className="text-blue-400 hover:text-blue-300 text-sm">
          Back to sessions
        </Link>
      </div>
    );
  }

  const { session, worktree, events } = detail;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/sessions")} className="text-gray-500 hover:text-gray-300 text-sm">
          &larr; Sessions
        </button>
        <SessionStatusBadge status={session.status} />
        <h2 className="text-xl font-semibold text-gray-100 truncate flex-1">{session.task_description}</h2>
      </div>

      <MetadataSection session={session} />

      {session.snapshots.length > 0 && <SnapshotTimeline snapshots={session.snapshots} />}

      {worktree && <WorktreeSection worktree={worktree} />}

      {events.length > 0 && <EventsSection events={events} sessionId={session.id} />}

      <div className="flex gap-3 text-sm">
        <Link
          to={`/sessions/${session.id}/lineage`}
          className="px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800"
        >
          View Lineage
        </Link>
        <Link
          to={`/events?session=${session.id}`}
          className="px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800"
        >
          View All Events
        </Link>
      </div>
    </div>
  );
}

function MetadataSection({ session }: { session: SessionRecord }) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-900 rounded-lg p-4 border border-gray-800">
      <Field label="ID" value={session.id} mono />
      <Field label="Agent" value={session.agent_type} />
      <Field label="Project" value={session.project.split(/[/\\]/).pop() ?? session.project} />
      <Field label="Started" value={new Date(session.created_at).toLocaleString()} />
      {session.ended_at && <Field label="Ended" value={new Date(session.ended_at).toLocaleString()} />}
      {session.duration_ms != null && <Field label="Duration" value={formatDuration(session.duration_ms)} />}
      {session.exit_code != null && <Field label="Exit Code" value={String(session.exit_code)} />}
      <div>
        <dt className="text-xs text-gray-500">Correlation</dt>
        <dd>
          <button
            onClick={() => navigate(`/sessions?search=${session.correlation_id}`)}
            className="text-xs font-mono text-blue-400 hover:text-blue-300"
          >
            {session.correlation_id.slice(0, 12)}...
          </button>
        </dd>
      </div>
      {session.parent_id && (
        <div>
          <dt className="text-xs text-gray-500">Parent</dt>
          <dd>
            <button
              onClick={() => navigate(`/sessions/${session.parent_id}`)}
              className="text-xs font-mono text-blue-400 hover:text-blue-300"
            >
              {session.parent_id.slice(0, 12)}...
            </button>
          </dd>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`text-sm text-gray-300 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

import { useState } from "react";

function SnapshotTimeline({ snapshots }: { snapshots: SessionSnapshot[] }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...snapshots].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const hiddenCount = sorted.length - MAX_VISIBLE_SNAPSHOTS;
  const visible = expanded || sorted.length <= MAX_VISIBLE_SNAPSHOTS
    ? sorted
    : sorted.slice(hiddenCount);

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-400 mb-2">Snapshots</h3>
      {!expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-blue-400 hover:text-blue-300 mb-2"
        >
          Show {hiddenCount} earlier snapshot{hiddenCount !== 1 ? "s" : ""}
        </button>
      )}
      <div className="space-y-1">
        {visible.map((snap, i) => (
          <div key={i} className="flex gap-3 text-xs bg-gray-900 rounded px-3 py-2 border border-gray-800">
            <span className="text-gray-500 whitespace-nowrap">
              {new Date(snap.timestamp).toLocaleTimeString()}
            </span>
            <span className="text-blue-400 font-medium">{snap.label}</span>
            {snap.task_progress && <span className="text-gray-500">{snap.task_progress}</span>}
            {snap.files_changed.length > 0 && (
              <span className="text-gray-600">{snap.files_changed.length} file{snap.files_changed.length !== 1 ? "s" : ""}</span>
            )}
            {snap.decisions.length > 0 && (
              <span className="text-yellow-500">{snap.decisions.length} decision{snap.decisions.length !== 1 ? "s" : ""}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WorktreeSection({ worktree }: { worktree: WorktreeRecord }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-400 mb-2">Associated Worktree</h3>
      <Link
        to={`/worktrees`}
        className="block bg-gray-900 rounded-lg p-3 border border-gray-800 hover:border-gray-700 text-sm"
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-gray-300">{worktree.branch}</span>
          <span className={`px-2 py-0.5 rounded text-xs ${
            worktree.status === "active" ? "bg-green-900 text-green-300" :
            worktree.status === "conflict" ? "bg-red-900 text-red-300" :
            worktree.status === "merged" ? "bg-blue-900 text-blue-300" :
            "bg-gray-800 text-gray-400"
          }`}>
            {worktree.status}
          </span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {worktree.parent_branch} &rarr; {worktree.branch}
        </div>
      </Link>
    </div>
  );
}

function EventsSection({ events, sessionId }: { events: NexusEvent[]; sessionId: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-400">Recent Events</h3>
        <Link to={`/events?session=${sessionId}`} className="text-xs text-blue-400 hover:text-blue-300">
          View all
        </Link>
      </div>
      <div className="space-y-1">
        {events.map((e) => (
          <div key={e.id} className="flex gap-3 text-xs bg-gray-900 rounded px-3 py-2 border border-gray-800">
            <span className="text-gray-500 whitespace-nowrap">
              {new Date(e.timestamp).toLocaleTimeString()}
            </span>
            <span className="text-gray-400">{e.event_type}</span>
            <span className="text-gray-500 truncate">{summarizeEvent(e)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
