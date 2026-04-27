import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useDashboard } from "../../hooks.js";
import { detectOverlaps, summarizeEvent } from "@nexus/shared";
import type { WorktreeRecord, SessionRecord, NexusEvent, OverlapReport } from "@nexus/shared";
import { WorktreeStatusBadge } from "./WorktreeStatusBadge.js";

const MAX_RECENT_EVENTS = 20;

function getWorktreeDetail(
  worktrees: WorktreeRecord[],
  sessions: SessionRecord[],
  events: NexusEvent[],
  worktreeId: string,
): {
  worktree: WorktreeRecord;
  session: SessionRecord | null;
  events: NexusEvent[];
  overlaps: OverlapReport[];
} | null {
  const worktree = worktrees.find((w) => w.id === worktreeId);
  if (!worktree) return null;
  const session = sessions.find((s) => s.id === worktree.session_id) ?? null;
  const wtEvents = events
    .filter((e) => {
      const p = e.payload as Record<string, unknown>;
      return p.worktree_id === worktreeId || e.session_id === worktree.session_id;
    })
    .filter((e) => e.event_type.startsWith("worktree."))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, MAX_RECENT_EVENTS);
  const allOverlaps = detectOverlaps(worktrees);
  const overlaps = allOverlaps.filter(
    (o) => o.worktree_a.id === worktreeId || o.worktree_b.id === worktreeId,
  );
  return { worktree, session, events: wtEvents, overlaps };
}

function truncatePath(path: string, maxLen = 50): string {
  if (path.length <= maxLen) return path;
  const start = path.slice(0, 20);
  const end = path.slice(-(maxLen - 23));
  return `${start}...${end}`;
}

export function WorktreeDetail() {
  const { id } = useParams<{ id: string }>();
  const { data } = useDashboard();
  const navigate = useNavigate();

  const detail = useMemo(
    () => (id ? getWorktreeDetail(data.worktrees, data.sessions, data.events, id) : null),
    [data.worktrees, data.sessions, data.events, id],
  );

  if (!detail) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-gray-400">Worktree not found</p>
        <Link to="/worktrees" className="text-blue-400 hover:text-blue-300 text-sm">
          Back to worktrees
        </Link>
      </div>
    );
  }

  const { worktree, session, events, overlaps } = detail;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/worktrees")} className="text-gray-500 hover:text-gray-300 text-sm">
          &larr; Worktrees
        </button>
        <WorktreeStatusBadge status={worktree.status} />
        <h2 className="text-xl font-semibold text-gray-100 font-mono">{worktree.branch}</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-900 rounded-lg p-4 border border-gray-800">
        <Field label="ID" value={worktree.id} mono />
        <Field label="Project" value={worktree.project.split(/[/\\]/).pop() ?? worktree.project} />
        <Field label="Parent Branch" value={worktree.parent_branch} mono />
        <div title={worktree.path}>
          <dt className="text-xs text-gray-500">Path</dt>
          <dd className="text-xs font-mono text-gray-300">{truncatePath(worktree.path)}</dd>
        </div>
        <Field label="Created" value={new Date(worktree.created_at).toLocaleString()} />
        {worktree.merged_at && <Field label="Merged" value={new Date(worktree.merged_at).toLocaleString()} />}
        {worktree.cleaned_at && <Field label="Cleaned" value={new Date(worktree.cleaned_at).toLocaleString()} />}
      </div>

      {session && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">Owning Session</h3>
          <Link
            to={`/sessions/${session.id}`}
            className="block bg-gray-900 rounded-lg p-3 border border-gray-800 hover:border-gray-700 text-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-gray-300">{session.task_description}</span>
              <span className="text-xs text-gray-500">{session.agent_type}</span>
            </div>
            <div className="text-xs text-gray-600 mt-1 font-mono">{session.id.slice(0, 12)}...</div>
          </Link>
        </div>
      )}

      {worktree.scope.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">Declared Scope</h3>
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 space-y-1">
            {worktree.scope.map((s) => (
              <div key={s} className="text-xs font-mono text-gray-300">{s}</div>
            ))}
            {overlaps.map((o, i) => {
              const other = o.worktree_a.id === worktree.id ? o.worktree_b : o.worktree_a;
              return (
                <div key={i} className="text-xs text-amber-400 mt-1">
                  ⚠ Overlaps with {other.branch}: {o.overlapping_paths.join(", ")}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {worktree.merge_result && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">Merge Result</h3>
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 text-sm">
            <div className={worktree.merge_result.success ? "text-green-400" : "text-red-400"}>
              {worktree.merge_result.success ? "Merged successfully" : "Merge failed"}
            </div>
            <div className="text-gray-500 text-xs mt-1">
              {worktree.merge_result.commits_merged} commit{worktree.merge_result.commits_merged !== 1 ? "s" : ""} merged
            </div>
            {worktree.merge_result.conflicts.length > 0 && (
              <div className="mt-2 space-y-0.5">
                <div className="text-xs text-red-400">Conflicts:</div>
                {worktree.merge_result.conflicts.map((c) => (
                  <div key={c} className="text-xs font-mono text-red-300 ml-2">{c}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!worktree.merge_result && worktree.status !== "merged" && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">Merge Result</h3>
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 text-sm text-gray-600">
            Not yet merged
          </div>
        </div>
      )}

      {worktree.status === "stale" && (
        <div className="bg-orange-900/20 border border-orange-800 rounded px-3 py-2 text-sm text-orange-300">
          This worktree is stale — its session is no longer running.
          <div className="mt-1 text-xs text-gray-500">
            Clean up via: <code className="bg-gray-800 px-1 rounded">nexus worktree clean {worktree.id}</code>
          </div>
        </div>
      )}

      {events.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">Recent Events</h3>
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
      )}

      <div className="flex gap-3 text-sm">
        {session && (
          <Link
            to={`/sessions/${session.id}`}
            className="px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800"
          >
            View Session
          </Link>
        )}
        <Link
          to={`/events?search=worktree`}
          className="px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800"
        >
          View All Events
        </Link>
      </div>
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
