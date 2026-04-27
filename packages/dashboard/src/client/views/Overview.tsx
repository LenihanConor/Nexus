import { useDashboard } from "../hooks.js";
import { formatDuration, summarizeEvent } from "@nexus/shared";
import type { NexusEvent, SessionRecord, WorktreeRecord } from "@nexus/shared";

export function Overview() {
  const { data, summary, loading } = useDashboard();

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Overview</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Active Sessions" value={summary.activeSessions} />
        <SummaryCard label="Active Worktrees" value={summary.activeWorktrees} />
        <SummaryCard label="Events Today" value={summary.eventsToday} />
        <SummaryCard
          label="Issues"
          value={summary.staleSessions + summary.conflictedWorktrees}
          alert={summary.staleSessions + summary.conflictedWorktrees > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentSessions sessions={data.sessions} />
        <RecentEvents events={data.events} />
      </div>

      <WorktreeOverview worktrees={data.worktrees} />
    </div>
  );
}

function SummaryCard({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${alert ? "text-red-400" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function RecentSessions({ sessions }: { sessions: SessionRecord[] }) {
  const recent = sessions
    .filter((s) => s.status === "running")
    .slice(0, 5);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Active Sessions</h3>
      {recent.length === 0 ? (
        <p className="text-gray-600 text-sm">No active sessions</p>
      ) : (
        <div className="space-y-2">
          {recent.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="text-gray-300">{s.task_description}</span>
                <span className="text-gray-600 ml-2">{s.agent_type}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-gray-500 text-xs font-mono">{s.project.split(/[/\\]/).pop()}</span>
                <StatusBadge status={s.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentEvents({ events }: { events: NexusEvent[] }) {
  const recent = [...events]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 10);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Events</h3>
      {recent.length === 0 ? (
        <p className="text-gray-600 text-sm">No events today</p>
      ) : (
        <div className="space-y-1">
          {recent.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="text-blue-400 font-mono text-xs">{e.event_type}</span>
                <span className="text-gray-500 ml-2">{summarizeEvent(e)}</span>
              </div>
              <span className="text-gray-600 text-xs">
                {new Date(e.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorktreeOverview({ worktrees }: { worktrees: WorktreeRecord[] }) {
  const active = worktrees.filter((w) => w.status === "active" || w.status === "conflict" || w.status === "stale");

  if (active.length === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Active Worktrees</h3>
      <div className="space-y-2">
        {active.map((w) => (
          <div key={w.id} className="flex items-center justify-between text-sm">
            <div>
              <span className="text-gray-300 font-mono">{w.branch}</span>
              <span className="text-gray-600 ml-2">{w.project.split(/[/\\]/).pop()}</span>
            </div>
            <WorktreeStatusBadge status={w.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
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
