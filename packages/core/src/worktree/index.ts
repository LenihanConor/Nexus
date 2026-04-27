export { execGit, detectMainBranch } from "./git.js";
export type { GitResult } from "./git.js";
export {
  appendWorktreeRecord,
  getWorktree,
  listWorktrees,
  getWorktreeStorePath,
  resetStoreDirCache,
} from "./store.js";
export {
  createWorktree,
  mergeWorktree,
  cleanupWorktree,
  markStale,
  isWorktreeDirty,
  getWorktreePath,
} from "./lifecycle.js";
export { pathsOverlap, checkConflicts } from "./conflicts.js";
export {
  detectStaleWorktrees,
  startStaleDetection,
  stopStaleDetection,
  setSessionChecker,
} from "./stale.js";
export type { SessionChecker } from "./stale.js";
