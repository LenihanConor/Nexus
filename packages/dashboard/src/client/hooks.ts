import { useState, useEffect, useCallback, createContext, useContext } from "react";
import type { DashboardData, DashboardSummary } from "./types.js";

const POLL_INTERVAL = 5000;

const emptyData: DashboardData = {
  events: [],
  sessions: [],
  worktrees: [],
  projects: [],
  lastUpdated: new Date().toISOString(),
};

const emptySummary: DashboardSummary = {
  activeSessions: 0,
  activeWorktrees: 0,
  eventsToday: 0,
  staleSessions: 0,
  conflictedWorktrees: 0,
  lastUpdated: new Date().toISOString(),
};

interface DashboardContextValue {
  data: DashboardData;
  summary: DashboardSummary;
  project: string | null;
  setProject: (p: string | null) => void;
  loading: boolean;
}

export const DashboardContext = createContext<DashboardContextValue>({
  data: emptyData,
  summary: emptySummary,
  project: null,
  setProject: () => {},
  loading: true,
});

export function useDashboard(): DashboardContextValue {
  return useContext(DashboardContext);
}

function buildUrl(base: string, project: string | null): string {
  if (!project) return base;
  return `${base}?project=${encodeURIComponent(project)}`;
}

export function useDashboardData(project: string | null): {
  data: DashboardData;
  summary: DashboardSummary;
  loading: boolean;
} {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [dataRes, summaryRes] = await Promise.all([
        fetch(buildUrl("/api/data", project)),
        fetch(buildUrl("/api/summary", project)),
      ]);
      if (dataRes.ok) setData(await dataRes.json());
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } catch {
      // Server may be unavailable — keep stale data
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    void fetchData();
    const timer = setInterval(() => void fetchData(), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchData]);

  return { data, summary, loading };
}
