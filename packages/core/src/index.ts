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

export {
  estimateCost,
  MODEL_PRICING,
  appendUsageRecord,
  listUsageRecords,
  getUsageStorePath,
  resetStoreDirCache as resetBudgetStoreDirCache,
  loadBudgetConfig,
  saveBudgetConfig,
  getPeriodStart,
  computeSpend,
  evaluateBudget,
  recordUsage,
  checkBudget,
  resetBudget,
  resetBudgetAlertState,
} from "./budget/index.js";
export type { ModelPricing, PricingTable, UsageInput, BudgetResetRecord } from "./budget/index.js";

export {
  checkContextHealth,
  checkAndAlert,
  loadContextConfig,
  saveContextConfig,
  resetAlertState,
} from "./context/index.js";

export {
  classifyToolCall,
  DEFAULT_APPROVAL_CONFIG,
  loadApprovalConfig,
  saveApprovalConfig,
  readPending,
  writePending,
  addPending,
  resolvePending,
  listPending,
  cleanStalePending,
  writeResolution,
  readResolution,
  clearResolution,
  resetStoreDirCache as resetApprovalStoreDirCache,
  requestApproval,
} from "./approval/index.js";
export type { PendingStore } from "./approval/index.js";

export {
  BaseAdapter,
  GenericAdapter,
  ClaudeCodeAdapter,
  registerAdapter,
  getAdapter,
  listAdapters,
  runAgent,
  mapExitToStatus,
  generateHookConfig,
  installHooks,
  removeHooks,
  parseHookStdin,
} from "./adapter/index.js";
export type {
  AgentAdapter,
  AdapterStartOpts,
  AdapterSession,
  AdapterSnapshot,
  AdapterResult,
  RunnerOpts,
  RunnerResult,
  HookInput,
  ParsedHookData,
} from "./adapter/index.js";
