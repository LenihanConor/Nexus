export {
  emit,
  emitEvent,
  getEventFilePath,
  getEventsDir,
  getNexusDir,
  setNexusDir,
  query,
  tail,
  getEventFiles,
  matchesFilters,
  cleanupOldEvents,
  startCleanupSchedule,
  stopCleanupSchedule,
} from "./audit/index.js";
export type { EventQuery, RetentionConfig, CleanupResult } from "./audit/index.js";

export {
  createWorktree,
  mergeWorktree,
  cleanupWorktree,
  markStale,
  isWorktreeDirty,
  getWorktreePath,
  listWorktrees,
  getWorktree,
  checkConflicts,
  pathsOverlap,
  detectStaleWorktrees,
  startStaleDetection,
  stopStaleDetection,
  setSessionChecker,
  execGit,
  detectMainBranch,
} from "./worktree/index.js";
export type { GitResult, SessionChecker } from "./worktree/index.js";

export {
  createSession,
  updateSession,
  endSession,
  getSession,
  listSessions,
  getAllSessions,
  getLineage,
  getCorrelationGroup,
  buildSessionTree,
  isProcessAlive,
  detectStaleSessions,
  startSessionStaleDetection,
  stopSessionStaleDetection,
} from "./session/index.js";
