import { stat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { NexusEvent, SessionRecord, WorktreeRecord } from "@nexus/shared";
import { readJsonlFile } from "@nexus/shared";

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

interface FileMtime {
  path: string;
  mtime: number;
}

let nexusDir: string | null = null;

export function setNexusDir(dir: string): void {
  nexusDir = dir;
}

function getNexusDir(): string {
  return nexusDir ?? join(homedir(), ".nexus");
}

function getSessionsPath(): string {
  return join(getNexusDir(), "sessions", "sessions.jsonl");
}

function getWorktreesPath(): string {
  return join(getNexusDir(), "worktrees", "worktrees.jsonl");
}

function getEventsDir(): string {
  return join(getNexusDir(), "events");
}

function todayEventFile(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `events-${yyyy}-${mm}-${dd}.jsonl`;
}

async function getMtime(filePath: string): Promise<number | null> {
  try {
    const s = await stat(filePath);
    return s.mtimeMs;
  } catch {
    return null;
  }
}

async function readJsonlSafe<T>(filePath: string): Promise<T[]> {
  const records: T[] = [];
  try {
    for await (const record of readJsonlFile<T>(filePath)) {
      records.push(record);
    }
  } catch {
    // File missing or unreadable — return empty
  }
  return records;
}

export function deduplicateRecords<T extends { id: string }>(records: T[]): T[] {
  const map = new Map<string, T>();
  for (const record of records) {
    map.set(record.id, record);
  }
  return Array.from(map.values());
}

function normaliseProject(p: string): string {
  return p.replace(/\\/g, "/");
}

function deriveProjects(
  sessions: SessionRecord[],
  worktrees: WorktreeRecord[],
  events: NexusEvent[],
): string[] {
  const projects = new Set<string>();
  for (const s of sessions) {
    if (s.project) projects.add(normaliseProject(s.project));
  }
  for (const w of worktrees) {
    if (w.project) projects.add(normaliseProject(w.project));
  }
  for (const e of events) {
    if (e.project) projects.add(normaliseProject(e.project));
  }
  return Array.from(projects).sort();
}

export function computeSummary(data: DashboardData): DashboardSummary {
  return {
    activeSessions: data.sessions.filter((s) => s.status === "running").length,
    activeWorktrees: data.worktrees.filter((w) => w.status === "active").length,
    eventsToday: data.events.length,
    staleSessions: data.sessions.filter((s) => s.status === "stale").length,
    conflictedWorktrees: data.worktrees.filter((w) => w.status === "conflict").length,
    lastUpdated: data.lastUpdated,
  };
}

const EVENT_FILE_PATTERN = /^events-(\d{4}-\d{2}-\d{2})\.jsonl$/;

async function getEventFiles(from?: string, to?: string): Promise<string[]> {
  const eventsDir = getEventsDir();
  let entries: string[];
  try {
    entries = await readdir(eventsDir);
  } catch {
    return [];
  }

  const fromDate = from?.slice(0, 10);
  const toDate = to?.slice(0, 10);

  const files: { path: string; date: string }[] = [];
  for (const entry of entries) {
    const match = entry.match(EVENT_FILE_PATTERN);
    if (!match) continue;
    const date = match[1]!;
    if (fromDate && date < fromDate) continue;
    if (toDate && date > toDate) continue;
    files.push({ path: join(eventsDir, entry), date });
  }

  files.sort((a, b) => b.date.localeCompare(a.date));
  return files.map((f) => f.path);
}

export class DataCache {
  private sessions: SessionRecord[] = [];
  private worktrees: WorktreeRecord[] = [];
  private events: NexusEvent[] = [];
  private projects: string[] = [];
  private lastUpdated: string = new Date().toISOString();
  private fileMtimes = new Map<string, number>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  async loadInitial(): Promise<void> {
    this.sessions = deduplicateRecords(
      await readJsonlSafe<SessionRecord>(getSessionsPath()),
    );
    this.worktrees = deduplicateRecords(
      await readJsonlSafe<WorktreeRecord>(getWorktreesPath()),
    );

    const todayFile = join(getEventsDir(), todayEventFile());
    this.events = await readJsonlSafe<NexusEvent>(todayFile);

    this.projects = deriveProjects(this.sessions, this.worktrees, this.events);
    this.lastUpdated = new Date().toISOString();

    const sessionsMtime = await getMtime(getSessionsPath());
    if (sessionsMtime !== null) this.fileMtimes.set(getSessionsPath(), sessionsMtime);
    const worktreesMtime = await getMtime(getWorktreesPath());
    if (worktreesMtime !== null) this.fileMtimes.set(getWorktreesPath(), worktreesMtime);
    const todayMtime = await getMtime(todayFile);
    if (todayMtime !== null) this.fileMtimes.set(todayFile, todayMtime);
  }

  async poll(): Promise<void> {
    let changed = false;

    const sessionsPath = getSessionsPath();
    const sessionsMtime = await getMtime(sessionsPath);
    if (sessionsMtime !== null && sessionsMtime !== this.fileMtimes.get(sessionsPath)) {
      this.sessions = deduplicateRecords(
        await readJsonlSafe<SessionRecord>(sessionsPath),
      );
      this.fileMtimes.set(sessionsPath, sessionsMtime);
      changed = true;
    }

    const worktreesPath = getWorktreesPath();
    const worktreesMtime = await getMtime(worktreesPath);
    if (worktreesMtime !== null && worktreesMtime !== this.fileMtimes.get(worktreesPath)) {
      this.worktrees = deduplicateRecords(
        await readJsonlSafe<WorktreeRecord>(worktreesPath),
      );
      this.fileMtimes.set(worktreesPath, worktreesMtime);
      changed = true;
    }

    const todayFile = join(getEventsDir(), todayEventFile());
    const todayMtime = await getMtime(todayFile);
    if (todayMtime !== null && todayMtime !== this.fileMtimes.get(todayFile)) {
      this.events = await readJsonlSafe<NexusEvent>(todayFile);
      this.fileMtimes.set(todayFile, todayMtime);
      changed = true;
    }

    if (changed) {
      this.projects = deriveProjects(this.sessions, this.worktrees, this.events);
      this.lastUpdated = new Date().toISOString();
    }
  }

  startPolling(intervalMs: number = 5000): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => void this.poll(), intervalMs);
    this.pollTimer.unref();
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  getData(filters?: { project?: string; eventsFrom?: string; eventsTo?: string }): DashboardData {
    let sessions = this.sessions;
    let worktrees = this.worktrees;
    let events = this.events;

    if (filters?.project) {
      const project = normaliseProject(filters.project);
      sessions = sessions.filter((s) => normaliseProject(s.project) === project);
      worktrees = worktrees.filter((w) => normaliseProject(w.project) === project);
      events = events.filter((e) => e.project && normaliseProject(e.project) === project);
    }

    return {
      events,
      sessions,
      worktrees,
      projects: this.projects,
      lastUpdated: this.lastUpdated,
    };
  }

  async getDataWithDateRange(filters?: {
    project?: string;
    eventsFrom?: string;
    eventsTo?: string;
  }): Promise<DashboardData> {
    let events: NexusEvent[];
    if (filters?.eventsFrom || filters?.eventsTo) {
      events = [];
      const files = await getEventFiles(filters.eventsFrom, filters.eventsTo);
      for (const file of files) {
        const fileEvents = await readJsonlSafe<NexusEvent>(file);
        for (const e of fileEvents) {
          if (filters.eventsFrom && e.timestamp < filters.eventsFrom) continue;
          if (filters.eventsTo && e.timestamp > filters.eventsTo) continue;
          events.push(e);
        }
      }
    } else {
      events = this.events;
    }

    let sessions = this.sessions;
    let worktrees = this.worktrees;

    if (filters?.project) {
      const project = normaliseProject(filters.project);
      sessions = sessions.filter((s) => normaliseProject(s.project) === project);
      worktrees = worktrees.filter((w) => normaliseProject(w.project) === project);
      events = events.filter((e) => e.project && normaliseProject(e.project) === project);
    }

    return {
      events,
      sessions,
      worktrees,
      projects: this.projects,
      lastUpdated: this.lastUpdated,
    };
  }

  getSummary(project?: string): DashboardSummary {
    return computeSummary(this.getData(project ? { project } : undefined));
  }
}
