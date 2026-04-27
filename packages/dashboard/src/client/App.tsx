import { useState } from "react";
import { Routes, Route } from "react-router";
import { Shell } from "./Shell.js";
import { Overview } from "./views/Overview.js";
import { SessionList } from "./views/sessions/SessionList.js";
import { SessionDetail } from "./views/sessions/SessionDetail.js";
import { SessionLineage } from "./views/sessions/SessionLineage.js";
import { EventStream } from "./views/events/EventStream.js";
import { Worktrees } from "./views/Worktrees.js";
import { DashboardContext, useDashboardData } from "./hooks.js";
import { registerView } from "./registry.js";

registerView({ id: "sessions", label: "Sessions", route: "/sessions", order: 1, component: SessionList });
registerView({ id: "events", label: "Events", route: "/events", order: 2, component: EventStream });
registerView({ id: "worktrees", label: "Worktrees", route: "/worktrees", order: 3, component: Worktrees });

export function App() {
  const [project, setProject] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("project");
  });

  const { data, summary, loading } = useDashboardData(project);

  return (
    <DashboardContext value={{ data, summary, project, setProject, loading }}>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Overview />} />
          <Route path="sessions" element={<SessionList />} />
          <Route path="sessions/:id" element={<SessionDetail />} />
          <Route path="sessions/:id/lineage" element={<SessionLineage />} />
          <Route path="events" element={<EventStream />} />
          <Route path="worktrees" element={<Worktrees />} />
        </Route>
      </Routes>
    </DashboardContext>
  );
}
