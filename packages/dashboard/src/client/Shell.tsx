import { NavLink, Outlet } from "react-router";
import { useDashboard } from "./hooks.js";
import { getRegisteredViews } from "./registry.js";

export function Shell() {
  const { summary, project, setProject, data } = useDashboard();
  const views = getRegisteredViews();

  return (
    <div className="flex h-screen">
      <aside className="w-52 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-lg font-semibold text-white">Nexus</h1>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `block px-3 py-2 rounded text-sm ${isActive ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800/50"}`
            }
          >
            Overview
          </NavLink>
          {views.map((view) => (
            <NavLink
              key={view.id}
              to={view.route}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm ${isActive ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800/50"}`
              }
            >
              {view.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4">
          <div />
          <ProjectFilter
            projects={data.projects}
            selected={project}
            onChange={setProject}
          />
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>

        <footer className="h-8 bg-gray-900 border-t border-gray-800 flex items-center px-4 text-xs text-gray-500 gap-4">
          <span>{summary.activeSessions} active session{summary.activeSessions !== 1 ? "s" : ""}</span>
          <span>{summary.activeWorktrees} active worktree{summary.activeWorktrees !== 1 ? "s" : ""}</span>
          {summary.staleSessions > 0 && (
            <span className="text-yellow-500">{summary.staleSessions} stale</span>
          )}
          {summary.conflictedWorktrees > 0 && (
            <span className="text-red-500">{summary.conflictedWorktrees} conflict{summary.conflictedWorktrees !== 1 ? "s" : ""}</span>
          )}
          <span className="ml-auto">
            Updated {new Date(summary.lastUpdated).toLocaleTimeString()}
          </span>
        </footer>
      </div>
    </div>
  );
}

function ProjectFilter({
  projects,
  selected,
  onChange,
}: {
  projects: string[];
  selected: string | null;
  onChange: (p: string | null) => void;
}) {
  if (projects.length === 0) return null;

  return (
    <select
      value={selected ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="bg-gray-800 text-gray-300 text-sm rounded px-2 py-1 border border-gray-700 focus:outline-none focus:border-gray-600"
    >
      <option value="">All Projects</option>
      {projects.map((p) => (
        <option key={p} value={p}>
          {p.split(/[/\\]/).pop()}
        </option>
      ))}
    </select>
  );
}
