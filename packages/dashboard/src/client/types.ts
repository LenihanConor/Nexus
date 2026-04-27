import type { NexusEvent, SessionRecord, WorktreeRecord } from "@nexus/shared";
import type { ComponentType } from "react";

export interface DashboardData {
  events: NexusEvent[];
  sessions: SessionRecord[];
  worktrees: WorktreeRecord[];
  projects: string[];
  lastUpdated: string;
}

export interface DashboardSummary {
  activeSessions: number;
  activeWorktrees: number;
  eventsToday: number;
  staleSessions: number;
  conflictedWorktrees: number;
  lastUpdated: string;
}

export interface DashboardView {
  id: string;
  label: string;
  route: string;
  icon?: string;
  component: ComponentType;
  order: number;
}
